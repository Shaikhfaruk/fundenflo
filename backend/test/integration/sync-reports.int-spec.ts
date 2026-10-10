import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HOUR_MS } from '../../src/common/constants/time.constants.js';
import { Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const CAMPAIGN = 'sync-reports-spec';

const consent = { basis: 'consent', evidence: 'Agreed on a call, 10 Oct', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] };

type Change = { type: string; id: string; version: number; updatedAt: string };

describe('delta sync, lead reports and the partner dashboard', () => {
  let t: TestApp;
  let ops: StaffSession;
  let firm: string;
  let owner: AuthResult;
  let otherOwner: AuthResult;
  const leadIds: string[] = [];

  const sync = (token: string, query: Record<string, string>) => t.api().get('/v1/sync/changes').query(query).set(bearer(token));

  const drain = async (token: string, types: string, limit: number) => {
    const seen: Change[] = [];
    let since: string | undefined;
    for (let page = 0; page < 50; page += 1) {
      const response = await sync(token, { types, limit: String(limit), ...(since ? { since } : {}) }).expect(200);
      seen.push(...response.body.items);
      since = response.body.nextCursor;
      if (!response.body.hasMore) return { seen, since };
    }
    throw new Error('sync did not finish');
  };

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Abhay Kulkarni');
    const checker = await createStaffSession(t, Role.ops_lead, 'Bina Shroff');
    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    firm = await createPartnerFirm(t, { name: 'Chawla Tax Consultants', cityId: gurugramId, signedUpByUserId: ops.user.id });
    const otherFirm = await createPartnerFirm(t, { name: 'Dhillon Advisors', cityId: gurugramId, signedUpByUserId: ops.user.id });
    owner = await createPartnerSession(t, firm);
    otherOwner = await createPartnerSession(t, otherFirm);
    const rule = await t.api().post('/v1/admin/routing-rules').set(bearer(ops.accessToken)).send({
      key: 'sync_reports_spec',
      name: { en: 'Sync and reports spec' },
      content: { priority: 3, when: { attr: 'lead.campaign', op: 'eq', value: CAMPAIGN }, strategy: 'round_robin', pool: { organizationIds: [firm] } },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/routing-rules/${rule.body.id}/versions/1/submit`).set(bearer(ops.accessToken)).send({ reason: 'Spec rule' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(checker.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/routing-rules/${rule.body.id}/versions/1/publish`).set(bearer(ops.accessToken)).send({}).expect(200);
    for (const name of ['Esha Bose', 'Farhan Ali', 'Geeta Nair']) {
      const lead = await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ mobile: randomMobile(), name, segment: 'msme', category: 'business', city: 'Gurgaon', campaign: CAMPAIGN, consent }).expect(201);
      leadIds.push(lead.body.id);
      await t.api().post(`/v1/ops/leads/${lead.body.id}/route`).set(bearer(ops.accessToken)).expect(200);
    }
    await t.api().post(`/v1/partner/leads/${leadIds[0]}/accept`).set(bearer(owner.accessToken)).expect(200);
    await t.api().post(`/v1/partner/leads/${leadIds[0]}/follow-ups`).set(bearer(owner.accessToken)).send({ dueAt: new Date(Date.now() + 2 * HOUR_MS).toISOString(), note: 'Call about documents' }).expect(201);
    await t.api().post(`/v1/partner/leads/${leadIds[1]}/decline`).set(bearer(owner.accessToken)).send({ reason: 'capacity_full' }).expect(200);
  });

  afterAll(async () => {
    await t.close();
  });

  it('pages through changes without gaps or repeats and resumes from the cursor', async () => {
    const { seen, since } = await drain(ops.accessToken, 'lead', 2);
    const ids = seen.map((change) => change.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(leadIds));
    expect((await sync(ops.accessToken, { types: 'lead', since: since ?? '' }).expect(200)).body.items).toEqual([]);

    const lead = await t.api().get(`/v1/ops/leads/${leadIds[2]}`).set(bearer(ops.accessToken)).expect(200);
    await t.api().patch(`/v1/ops/leads/${leadIds[2]}`).set(bearer(ops.accessToken)).set('If-Match', `"${lead.body.version}"`).send({ tenureMonths: 24 }).expect(200);
    const after = await sync(ops.accessToken, { types: 'lead', since: since ?? '' }).expect(200);
    expect(after.body.items).toEqual([expect.objectContaining({ type: 'lead', id: leadIds[2], version: lead.body.version + 1 })]);

    const caughtUp = await sync(ops.accessToken, { types: 'lead', updatedSince: after.body.items[0].updatedAt }).expect(200);
    expect(caughtUp.body.items.map((change: Change) => change.id)).toEqual([leadIds[2]]);
    expect((await sync(ops.accessToken, { types: 'lead', updatedSince: new Date(Date.now() + HOUR_MS).toISOString() }).expect(200)).body.items).toEqual([]);
    await sync(ops.accessToken, { updatedSince: 'not-a-date' }).expect(400);
    await sync(ops.accessToken, { since: 'garbage' }).expect(400);
    await sync(ops.accessToken, { types: 'payout' }).expect(400);
  });

  it('only shows a CA the leads, assignments and follow-ups of its firm', async () => {
    const { seen } = await drain(owner.accessToken, 'assignment,follow_up,lead', 3);
    const byType = (type: string) => seen.filter((change) => change.type === type).map((change) => change.id);
    expect(byType('lead')).toEqual(expect.arrayContaining([leadIds[0], leadIds[2]]));
    expect(byType('lead')).not.toContain(leadIds[1]);
    expect(byType('assignment')).toHaveLength(3);
    expect(byType('follow_up')).toHaveLength(1);
    const outsider = await drain(otherOwner.accessToken, 'assignment,follow_up,lead', 50);
    expect(outsider.seen).toEqual([]);
  });

  it('reports the funnel by campaign and city and partner performance', async () => {
    const funnel = await t.api().get('/v1/ops/reports/leads/funnel').query({ groupBy: 'campaign' }).set(bearer(ops.accessToken)).expect(200);
    expect(funnel.body.items.find((row: { key: string }) => row.key === CAMPAIGN)).toMatchObject({ total: 3, byConsent: { ok: 3 }, byStatus: { in_progress: 1, new: 2 } });
    const byCity = await t.api().get('/v1/ops/reports/leads/funnel').query({ groupBy: 'city' }).set(bearer(ops.accessToken)).expect(200);
    expect(byCity.body.items.map((row: { label: string }) => row.label)).toContain('Gurugram');
    await t.api().get('/v1/ops/reports/leads/funnel').query({ from: '2025-01-01', to: '2026-10-10' }).set(bearer(ops.accessToken)).expect(400);

    const performance = await t.api().get('/v1/ops/reports/partners/performance').set(bearer(ops.accessToken)).expect(200);
    expect(performance.body.items.find((row: { organization: { id: string } }) => row.organization.id === firm)).toMatchObject({ organization: { name: 'Chawla Tax Consultants' }, offers: 3, accepted: 1, declined: 1, open: 2, acceptRate: 1, firstContactMissed: 0 });
    await t.api().get('/v1/ops/reports/partners/performance').set(bearer(owner.accessToken)).expect(403);
  });

  it('gives the CA a dashboard of what needs attention', async () => {
    const dashboard = await t.api().get('/v1/partner/dashboard').set(bearer(owner.accessToken)).expect(200);
    expect(dashboard.body).toMatchObject({ leads: { offered: 1, active: 1, firstContactDue: 1 }, followUps: { dueToday: expect.any(Number), overdue: 0 }, conversions: { pending: 0, wonThisMonth: 0 }, referrals: { protected: 0 } });
  });
});
