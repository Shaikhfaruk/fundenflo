import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HOUR_MS } from '../../src/common/constants/time.constants.js';
import { Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { SlaService } from '../../src/modules/sla/application/sla.service.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const CAMPAIGN = 'lead-activities-spec';

const consent = { basis: 'consent', evidence: 'Agreed on a call, 10 Oct', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] };

describe('SLA timers, activities and follow-ups on leads', () => {
  let t: TestApp;
  let ops: StaffSession;
  let firm: string;
  let owner: AuthResult;
  let agent: AuthResult;

  const sweep = (at: number) => t.app.get(ClsService).run(() => t.app.get(SlaService).sweep(new Date(at)));

  const lead = async (name: string) =>
    (await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ mobile: randomMobile(), name, segment: 'msme', category: 'business', city: 'Gurgaon', campaign: CAMPAIGN, consent }).expect(201)).body;

  const routed = async (name: string) => {
    const created = await lead(name);
    const result = (await t.api().post(`/v1/ops/leads/${created.id}/route`).set(bearer(ops.accessToken)).expect(200)).body;
    return { lead: created, assignment: result.assignments[0] };
  };

  const timers = (assignmentId: string) => t.prisma.slaTimer.findMany({ where: { entityId: assignmentId }, orderBy: { createdAt: 'asc' } });

  const partner = (session: AuthResult) => ({
    get: (path: string) => t.api().get(`/v1/partner${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1/partner${path}`).set(bearer(session.accessToken)).send(body),
  });

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Meenakshi Rao');
    const checker = await createStaffSession(t, Role.ops_lead, 'Naveen Joshi');
    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    firm = await createPartnerFirm(t, { name: 'Oberoi Tax Associates', cityId: gurugramId, signedUpByUserId: ops.user.id });
    owner = await createPartnerSession(t, firm);
    agent = await createPartnerSession(t, firm, Role.partner_agent);
    const rule = await t.api().post('/v1/admin/routing-rules').set(bearer(ops.accessToken)).send({
      key: 'activities_spec',
      name: { en: 'Activities spec' },
      content: { priority: 4, when: { attr: 'lead.campaign', op: 'eq', value: CAMPAIGN }, strategy: 'round_robin', pool: { organizationIds: [firm] }, sla: { acceptHours: 2, firstContactHours: 4 } },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/routing-rules/${rule.body.id}/versions/1/submit`).set(bearer(ops.accessToken)).send({ reason: 'Activities spec rule' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(checker.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/routing-rules/${rule.body.id}/versions/1/publish`).set(bearer(ops.accessToken)).send({}).expect(200);
  });

  afterAll(async () => {
    await t.close();
  });

  it('expires an offer when the accept timer runs out', async () => {
    const { lead: created, assignment } = await routed('Om Prakash');
    const [accept] = await timers(assignment.id);
    expect(accept).toMatchObject({ kind: 'lead_assignment.accept', status: 'pending' });
    expect(accept?.dueAt.toISOString()).toBe(assignment.respondBy);
    expect(accept?.warnAt?.getTime()).toBeLessThan(accept?.dueAt.getTime() ?? 0);

    const result = await sweep(Date.parse(assignment.respondBy) + 1_000);
    expect(result.breached).toBeGreaterThanOrEqual(1);
    expect((await timers(assignment.id))[0]?.status).toBe('breached');
    const detail = await t.api().get(`/v1/ops/leads/${created.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(detail.body.assignments[0]).toMatchObject({ status: 'expired', reason: 'accept_sla_missed' });
  });

  it('warns and then flags a lead when the CA misses first contact, and is satisfied by a logged call', async () => {
    const missed = await routed('Pallavi Desai');
    const accepted = await partner(owner).post(`/leads/${missed.lead.id}/accept`).expect(200);
    const firstContactBy = Date.parse(accepted.body.assignment.firstContactBy);
    expect(firstContactBy - Date.now()).toBeGreaterThan(3.9 * HOUR_MS);
    expect((await timers(missed.assignment.id)).map((timer) => [timer.kind, timer.status])).toEqual([['lead_assignment.accept', 'satisfied'], ['lead_assignment.first_contact', 'pending']]);

    await sweep(firstContactBy - 0.5 * HOUR_MS);
    await sweep(firstContactBy + 1_000);
    const flagged = await t.api().get(`/v1/ops/leads/${missed.lead.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(flagged.body.flags).toContain('first_contact_missed');
    expect(flagged.body.events.map((event: { type: string }) => event.type)).toEqual(expect.arrayContaining(['sla_warned', 'sla_breached']));

    const worked = await routed('Qadir Khan');
    await partner(owner).post(`/leads/${worked.lead.id}/accept`).expect(200);
    const call = await partner(owner).post(`/leads/${worked.lead.id}/activities`, { type: 'call', outcome: 'no_answer', durationSeconds: 0 }).expect(201);
    expect(call.body).toMatchObject({ type: 'call', outcome: 'no_answer', organizationId: firm });
    expect((await timers(worked.assignment.id)).at(-1)?.status).toBe('satisfied');
    const view = await partner(owner).get(`/leads/${worked.lead.id}`).expect(200);
    expect(view.body.assignment.status).toBe('working');
    await sweep(Date.now() + 5 * HOUR_MS);
    const clean = await t.api().get(`/v1/ops/leads/${worked.lead.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(clean.body.flags).not.toContain('first_contact_missed');
  });

  it('keeps ops notes private, validates activities and marks a wrong number', async () => {
    const { lead: created } = await routed('Rekha Pillai');
    await partner(owner).post(`/leads/${created.id}/activities`, { type: 'note', body: 'Before accepting' }).expect(409);
    await partner(owner).post(`/leads/${created.id}/accept`).expect(200);
    await t.api().post(`/v1/ops/leads/${created.id}/activities`).set(bearer(ops.accessToken)).send({ type: 'note', body: 'Borrower prefers Hindi; ops called to confirm consent' }).expect(201);
    await partner(owner).post(`/leads/${created.id}/activities`, { type: 'note' }).expect(400);
    await partner(owner).post(`/leads/${created.id}/activities`, { type: 'meeting', outcome: 'connected' }).expect(400);
    await partner(owner).post(`/leads/${created.id}/activities`, { type: 'call', occurredAt: new Date(Date.now() + HOUR_MS).toISOString() }).expect(400);

    const revealed = await partner(owner).post(`/leads/${created.id}/reveal-contact`, { reason: 'Calling the borrower' }).expect(200);
    await partner(owner).post(`/leads/${created.id}/activities`, { type: 'call', outcome: 'wrong_number', contactId: revealed.body.contacts[0].id, body: 'Number belongs to someone else' }).expect(201);

    const partnerView = await partner(owner).get(`/leads/${created.id}/activities`).expect(200);
    expect(partnerView.body.items.map((item: { type: string }) => item.type)).toEqual(['call']);
    const opsView = await t.api().get(`/v1/ops/leads/${created.id}/activities`).set(bearer(ops.accessToken)).expect(200);
    expect(opsView.body.items.map((item: { type: string }) => item.type)).toEqual(['call', 'note']);
    const detail = await t.api().get(`/v1/ops/leads/${created.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(detail.body.flags).toContain('invalid_number');
    expect(detail.body.contacts[0].invalid).toBe(true);
  });

  it('schedules follow-ups for the firm, scopes them per member and cancels them when the lead leaves the firm', async () => {
    const { lead: created } = await routed('Sanjay Gupta');
    await partner(owner).post(`/leads/${created.id}/accept`).expect(200);
    const tomorrow = new Date(Date.now() + 24 * HOUR_MS).toISOString();
    await partner(owner).post(`/leads/${created.id}/follow-ups`, { dueAt: new Date(Date.now() - HOUR_MS).toISOString(), note: 'Too late' }).expect(400);
    const own = await partner(owner).post(`/leads/${created.id}/follow-ups`, { dueAt: tomorrow, note: 'Call back about GST returns' }).expect(201);
    const handed = await partner(owner).post(`/leads/${created.id}/follow-ups`, { dueAt: tomorrow, note: 'Collect bank statements', assigneeMembershipId: agent.user.activeContext?.membershipId }).expect(201);
    expect(handed.body.assigneeUserId).toBe(agent.user.id);

    const agentList = await partner(agent).get('/follow-ups').query({ assignee: 'all' }).expect(200);
    expect(agentList.body.items.map((item: { id: string }) => item.id)).toEqual([handed.body.id]);
    const ownerList = await partner(owner).get('/follow-ups').query({ assignee: 'all' }).expect(200);
    expect(ownerList.body.items.find((item: { id: string }) => item.id === own.body.id).lead).toMatchObject({ ref: created.ref, name: 'Sanjay Gupta' });

    const done = await t.api().patch(`/v1/partner/follow-ups/${handed.body.id}`).set(bearer(agent.accessToken)).set('If-Match', `"${handed.body.version}"`).send({ status: 'done', outcomeNote: 'Statements received' }).expect(200);
    expect(done.body).toMatchObject({ status: 'done', outcomeNote: 'Statements received' });
    await t.api().patch(`/v1/partner/follow-ups/${own.body.id}`).set(bearer(agent.accessToken)).send({ status: 'done' }).expect(404);

    await partner(owner).post(`/leads/${created.id}/return`, { reason: 'not_interested', note: 'Borrower dropped the plan' }).expect(200);
    expect((await t.prisma.followUp.findUniqueOrThrow({ where: { id: own.body.id } })).status).toBe('cancelled');

    const opsFollowUp = await t.api().post(`/v1/ops/leads/${created.id}/follow-ups`).set(bearer(ops.accessToken)).send({ dueAt: tomorrow, note: 'Ops to re-check interest' }).expect(201);
    const mine = await t.api().get('/v1/ops/follow-ups').set(bearer(ops.accessToken)).expect(200);
    expect(mine.body.items.map((item: { id: string }) => item.id)).toEqual([opsFollowUp.body.id]);
    const all = await t.api().get('/v1/ops/follow-ups').query({ assignee: 'all', status: 'cancelled' }).set(bearer(ops.accessToken)).expect(200);
    expect(all.body.items.map((item: { id: string }) => item.id)).toContain(own.body.id);
  });
});
