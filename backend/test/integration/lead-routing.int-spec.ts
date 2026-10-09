import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { OrganizationStatus, OrganizationType, PartnerKind, PartnerLevel, PartnerVerificationStatus, PartyKind, Role } from '../../src/common/enums/db.enums.js';
import { QueueName } from '../../src/infrastructure/queue/queue-names.js';
import { QueueRegistry } from '../../src/infrastructure/queue/queue-registry.service.js';
import { LeadRoutingService } from '../../src/modules/leads/application/lead-routing.service.js';
import { bearer, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const CAMPAIGN = 'routing-spec';

const consent = (items: Array<Record<string, unknown>>) => ({ basis: 'consent', evidence: 'Agreed on a call, 10 Oct', items });

const fullConsent = consent([{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }]);

describe('lead routing to CAs', () => {
  let t: TestApp;
  let ops: StaffSession;
  let checker: StaffSession;
  let gurugramId: string;
  let mumbaiId: string;
  let partnerA: string;
  let partnerB: string;
  let partnerMumbai: string;
  let partnerFull: string;
  let partnerHome: string;

  const inContext = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);

  const partner = async (name: string, options: { cityId: string; level?: PartnerLevel; maxOpenLeads?: number | null; categories?: string[] }) => {
    const party = await t.prisma.party.create({ data: { kind: PartyKind.business, displayName: name } });
    const organization = await t.prisma.organization.create({ data: { partyId: party.id, type: OrganizationType.partner, name, status: OrganizationStatus.active } });
    await t.prisma.partnerProfile.create({
      data: {
        organizationId: organization.id,
        kind: PartnerKind.ca,
        level: options.level ?? PartnerLevel.active,
        verificationStatus: PartnerVerificationStatus.verified,
        maxOpenLeads: options.maxOpenLeads ?? null,
        segments: ['msme'],
        categories: options.categories ?? [],
        signedUpByUserId: ops.user.id,
        serviceAreas: { create: [{ cityId: options.cityId }] },
      },
    });
    return organization.id;
  };

  const lead = async (body: Record<string, unknown>) =>
    (await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ mobile: randomMobile(), segment: 'msme', category: 'business', campaign: CAMPAIGN, ...body }).expect(201)).body;

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Tanvi Kulkarni');
    checker = await createStaffSession(t, Role.ops_lead, 'Arvind Pillai');
    gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    mumbaiId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Mumbai' }).expect(200)).body.items[0].id;
    partnerA = await partner('Alpha Associates', { cityId: gurugramId });
    partnerB = await partner('Bharat Tax Advisors', { cityId: gurugramId, categories: ['business', 'working-capital'] });
    partnerFull = await partner('Full House CAs', { cityId: gurugramId, maxOpenLeads: 0 });
    partnerMumbai = await partner('Marine Drive Consultants', { cityId: mumbaiId });
    partnerHome = await partner('Home Loans Only', { cityId: gurugramId, categories: ['home'] });

    const rule = await t.api().post('/v1/admin/routing-rules').set(bearer(ops.accessToken)).send({
      key: 'msme_haryana',
      name: { en: 'MSME leads in Haryana' },
      content: {
        priority: 10,
        when: { all: [{ attr: 'lead.segment', op: 'eq', value: 'msme' }, { attr: 'lead.state', op: 'eq', value: '06' }, { attr: 'lead.campaign', op: 'eq', value: CAMPAIGN }] },
        strategy: 'round_robin',
        pool: { organizationIds: [partnerA, partnerB, partnerFull, partnerMumbai, partnerHome] },
        sla: { acceptHours: 2 },
      },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/routing-rules/${rule.body.id}/versions/1/submit`).set(bearer(ops.accessToken)).send({ reason: 'Start distributing Haryana MSME leads' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(checker.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/routing-rules/${rule.body.id}/versions/1/publish`).set(bearer(ops.accessToken)).send({}).expect(200);
  });

  afterAll(async () => {
    await t.close();
  });

  it('validates rule conditions against lead attributes and the dictionary', async () => {
    const bad = await t.api().post('/v1/admin/routing-rules').set(bearer(ops.accessToken)).send({
      key: 'broken_rule',
      name: { en: 'Broken' },
      content: { when: { attr: 'lead.colour', op: 'eq', value: 'red' }, strategy: 'round_robin', pool: { organizationIds: [partnerA, gurugramId] } },
    }).expect(201);
    const submit = await t.api().post(`/v1/admin/routing-rules/${bad.body.id}/versions/1/submit`).set(bearer(ops.accessToken)).send({ reason: 'Trying a bad rule' }).expect(400);
    expect(submit.body.details.map((detail: { path: string }) => detail.path).toSorted()).toEqual(['content.pool.organizationIds.1', 'content.when.attr']);
  });

  it('offers a consented lead to an eligible CA, honouring area, category and capacity, with an accept deadline', async () => {
    const created = await lead({ name: 'Gita Rao', city: 'Gurgaon', consent: fullConsent });
    const simulated = await t.api().post('/v1/admin/routing-rules/simulate').set(bearer(ops.accessToken)).send({ leadId: created.id }).expect(200);
    expect(simulated.body).toMatchObject({ outcome: 'offered', rule: { key: 'msme_haryana' }, assignments: [] });
    expect([partnerA, partnerB]).toContain(simulated.body.candidates[0]);

    const routed = await t.api().post(`/v1/ops/leads/${created.id}/route`).set(bearer(ops.accessToken)).expect(200);
    expect(routed.body.outcome).toBe('offered');
    const offeredTo = routed.body.assignments[0].organizationId;
    expect([partnerA, partnerB]).toContain(offeredTo);
    expect([partnerFull, partnerMumbai, partnerHome]).not.toContain(offeredTo);
    const hoursLeft = (Date.parse(routed.body.assignments[0].respondBy) - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(1.9);
    expect(hoursLeft).toBeLessThanOrEqual(2);

    const expiryJob = await t.app.get(QueueRegistry).get(QueueName.LeadsRoute).getJob(`expire-${routed.body.assignments[0].id}`);
    expect(expiryJob?.opts.delay).toBe(2 * 3_600_000);
    const detail = await t.api().get(`/v1/ops/leads/${created.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(detail.body.assignments[0]).toMatchObject({ status: 'offered', strategy: 'round_robin', organization: { id: offeredTo } });
    expect(detail.body.events[0]).toMatchObject({ type: 'routed', data: { outcome: 'offered', rule: 'msme_haryana' } });

    expect((await t.api().post(`/v1/ops/leads/${created.id}/route`).set(bearer(ops.accessToken)).expect(200)).body.outcome).toBe('already_assigned');
    const assigned = await t.api().get('/v1/ops/leads').query({ assigned: 'true', q: created.ref }).set(bearer(ops.accessToken)).expect(200);
    expect(assigned.body.items).toHaveLength(1);
  });

  it('expires missed offers and moves to the next CA, then runs out of CAs', async () => {
    const created = await lead({ name: 'Ishaan Bedi', city: 'Gurgaon', consent: fullConsent });
    const first = (await t.api().post(`/v1/ops/leads/${created.id}/route`).set(bearer(ops.accessToken)).expect(200)).body.assignments[0];
    await t.prisma.leadAssignment.update({ where: { id: first.id }, data: { respondBy: new Date(Date.now() - 1_000) } });
    expect(await inContext(() => t.app.get(LeadRoutingService).expire(first.id))).toBe(true);
    expect(await inContext(() => t.app.get(LeadRoutingService).expire(first.id))).toBe(false);

    const second = (await t.api().post(`/v1/ops/leads/${created.id}/route`).set(bearer(ops.accessToken)).expect(200)).body.assignments[0];
    expect(second.organizationId).not.toBe(first.organizationId);
    await t.api().post(`/v1/ops/leads/assignments/${second.id}/revoke`).set(bearer(ops.accessToken)).send({ reason: 'CA asked to pause' }).expect(200);
    expect((await t.api().post(`/v1/ops/leads/${created.id}/route`).set(bearer(ops.accessToken)).expect(200)).body.outcome).toBe('no_candidate');
    const statuses = (await t.prisma.leadAssignment.findMany({ where: { leadId: created.id }, orderBy: { offeredAt: 'asc' } })).map((assignment) => assignment.status);
    expect(statuses).toEqual(['expired', 'revoked']);
  });

  it('never shares without consent, and respects consent scoped to one CA', async () => {
    const pending = await lead({ name: 'No Consent', city: 'Gurgaon', consent: consent([{ purpose: 'contact', granted: true }]) });
    expect((await t.api().post(`/v1/ops/leads/${pending.id}/route`).set(bearer(ops.accessToken)).expect(200)).body.outcome).toBe('consent_pending');
    await t.api().post(`/v1/ops/leads/${pending.id}/assign`).set(bearer(ops.accessToken)).send({ organizationId: partnerA }).expect(403);

    const scoped = await lead({ name: 'Only Bharat', city: 'Gurgaon', consent: consent([{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true, organizationIds: [partnerB] }]) });
    const routed = await t.api().post(`/v1/ops/leads/${scoped.id}/route`).set(bearer(ops.accessToken)).expect(200);
    expect(routed.body.assignments.map((assignment: { organizationId: string }) => assignment.organizationId)).toEqual([partnerB]);
    await t.api().post(`/v1/ops/leads/${scoped.id}/assign`).set(bearer(ops.accessToken)).send({ organizationId: partnerA }).expect(409);
  });

  it('lets ops assign manually and in bulk, and leaves leads without a rule to ops', async () => {
    const mumbai = await lead({ name: 'Rohan Shah', city: 'Mumbai', consent: fullConsent });
    expect((await t.api().post(`/v1/ops/leads/${mumbai.id}/route`).set(bearer(ops.accessToken)).expect(200)).body.outcome).toBe('no_rule');
    const manual = await t.api().post(`/v1/ops/leads/${mumbai.id}/assign`).set(bearer(ops.accessToken)).send({ organizationId: partnerMumbai, note: 'Known to this CA' }).expect(201);
    expect(manual.body).toMatchObject({ organizationId: partnerMumbai, status: 'offered' });

    const others = [await lead({ name: 'Bulk One', city: 'Mumbai', consent: fullConsent }), await lead({ name: 'Bulk Two', city: 'Mumbai' })];
    const bulk = await t.api().post('/v1/ops/leads/bulk-assign').set(bearer(ops.accessToken)).send({ leadIds: others.map((item) => item.id), organizationId: partnerMumbai }).expect(200);
    expect(bulk.body.items.map((item: { error: { code: string } | null }) => item.error?.code ?? 'ok')).toEqual(['ok', 'CONSENT_REQUIRED']);
    const queued = await t.api().post('/v1/ops/leads/bulk-route').set(bearer(ops.accessToken)).send({ leadIds: [mumbai.id, mumbai.id, others[1].id] }).expect(202);
    expect(queued.body).toEqual({ queued: 2 });
    const support = await createStaffSession(t, Role.support, 'Meera Iyer');
    await t.api().post('/v1/ops/leads/bulk-assign').set(bearer(support.accessToken)).send({ leadIds: [mumbai.id], organizationId: partnerMumbai }).expect(403);
  });
});
