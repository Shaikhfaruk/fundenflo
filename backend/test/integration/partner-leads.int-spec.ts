import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { LeadService } from '../../src/modules/leads/application/lead.service.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const CAMPAIGN = 'partner-leads-spec';

const consent = { basis: 'consent', evidence: 'Agreed on a call, 10 Oct', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] };

describe('CA lead inbox and actions', () => {
  let t: TestApp;
  let ops: StaffSession;
  let firmA: string;
  let firmB: string;
  let ownerA: AuthResult;
  let agentA: AuthResult;
  let ownerB: AuthResult;
  let outsider: AuthResult;

  const lead = async (name: string) =>
    (await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ mobile: randomMobile(), name, businessName: `${name} Traders`, segment: 'msme', category: 'business', city: 'Gurgaon', campaign: CAMPAIGN, consent }).expect(201)).body;

  const route = async (leadId: string) => (await t.api().post(`/v1/ops/leads/${leadId}/route`).set(bearer(ops.accessToken)).expect(200)).body;

  const partnerApi = (session: AuthResult) => ({
    get: (path: string) => t.api().get(`/v1/partner/leads${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1/partner/leads${path}`).set(bearer(session.accessToken)).send(body),
  });

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Farah Siddiqui');
    const checker = await createStaffSession(t, Role.ops_lead, 'Gaurav Malhotra');
    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    firmA = await createPartnerFirm(t, { name: 'Aggarwal Tax Partners', cityId: gurugramId, signedUpByUserId: ops.user.id });
    firmB = await createPartnerFirm(t, { name: 'Bansal & Bedi', cityId: gurugramId, signedUpByUserId: ops.user.id });
    const firmC = await createPartnerFirm(t, { name: 'Chopra Advisory', cityId: gurugramId, signedUpByUserId: ops.user.id });
    ownerA = await createPartnerSession(t, firmA);
    agentA = await createPartnerSession(t, firmA, Role.partner_agent);
    ownerB = await createPartnerSession(t, firmB);
    outsider = await createPartnerSession(t, firmC);

    const rule = await t.api().post('/v1/admin/routing-rules').set(bearer(ops.accessToken)).send({
      key: 'partner_spec_broadcast',
      name: { en: 'Offer to two CAs at once' },
      content: { priority: 5, when: { attr: 'lead.campaign', op: 'eq', value: CAMPAIGN }, strategy: 'broadcast', offers: 2, pool: { organizationIds: [firmA, firmB] } },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/routing-rules/${rule.body.id}/versions/1/submit`).set(bearer(ops.accessToken)).send({ reason: 'Broadcast to two CAs' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(checker.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/routing-rules/${rule.body.id}/versions/1/publish`).set(bearer(ops.accessToken)).send({}).expect(200);
  });

  afterAll(async () => {
    await t.close();
  });

  it('shows a masked offer, lets the first CA accept and only then shows the person', async () => {
    const created = await lead('Gita Rao');
    expect((await route(created.id)).assignments).toHaveLength(2);

    const inbox = await partnerApi(ownerA).get('').query({ view: 'offered' }).expect(200);
    const offer = inbox.body.items.find((item: { lead: { id: string } }) => item.lead.id === created.id);
    expect(offer.lead).toMatchObject({ name: 'Gita R.', businessName: null, categoryKey: 'business' });
    expect(offer).not.toHaveProperty('contacts');

    const detail = await partnerApi(ownerA).get(`/${created.id}`).expect(200);
    expect(detail.body.availableActions).toEqual(['accept', 'decline']);
    expect(detail.body.contacts[0].masked).toMatch(/•/);
    await partnerApi(ownerA).post(`/${created.id}/reveal-contact`, { reason: 'Calling the borrower' }).expect(409);

    const accepted = await partnerApi(ownerA).post(`/${created.id}/accept`).expect(200);
    expect(accepted.body).toMatchObject({ assignment: { status: 'accepted', assigneeMembershipId: ownerA.user.activeContext?.membershipId }, lead: { name: 'Gita Rao', businessName: 'Gita Rao Traders', status: 'in_progress' } });
    expect(accepted.body.availableActions).toEqual(['reveal_contact', 'log_activity', 'follow_up', 'edit', 'offline_conversion', 'return', 'lost', 'sub_assign']);

    await partnerApi(ownerB).get(`/${created.id}`).expect(404);
    await partnerApi(ownerB).post(`/${created.id}/accept`).expect(404);
    await partnerApi(outsider).get(`/${created.id}`).expect(404);
    const closedForB = await partnerApi(ownerB).get('').query({ view: 'closed' }).expect(200);
    expect(closedForB.body.items.find((item: { lead: { id: string } }) => item.lead.id === created.id)).toMatchObject({ assignment: { status: 'revoked', reason: 'accepted_by_another_partner' }, lead: { name: 'Gita R.' } });

    const revealed = await partnerApi(ownerA).post(`/${created.id}/reveal-contact`, { reason: 'First call to the borrower' }).expect(200);
    expect(revealed.body.contacts[0].value).toMatch(/^\+91\d{10}$/);
    expect((await partnerApi(ownerA).get(`/${created.id}`).expect(200)).body.assignment.status).toBe('working');
    const timeline = (await t.api().get(`/v1/ops/leads/${created.id}`).set(bearer(ops.accessToken)).expect(200)).body.events;
    expect(timeline.find((event: { type: string }) => event.type === 'contact_revealed').data).toMatchObject({ organizationId: firmA });
  });

  it('lets the owner hand a lead to an agent, who sees and works only their own leads', async () => {
    const created = await lead('Harish Nair');
    await route(created.id);
    await partnerApi(ownerA).post(`/${created.id}/accept`).expect(200);
    await partnerApi(agentA).get(`/${created.id}`).expect(404);

    const agentMembershipId = agentA.user.activeContext?.membershipId;
    await partnerApi(ownerA).post(`/${created.id}/sub-assign`, { membershipId: ownerB.user.activeContext?.membershipId }).expect(400);
    const handed = await partnerApi(ownerA).post(`/${created.id}/sub-assign`, { membershipId: agentMembershipId }).expect(200);
    expect(handed.body.assignment.assigneeMembershipId).toBe(agentMembershipId);

    expect((await partnerApi(agentA).get(`/${created.id}`).expect(200)).body.availableActions).toEqual(['reveal_contact', 'log_activity', 'follow_up', 'edit', 'offline_conversion', 'return', 'lost']);
    await partnerApi(agentA).post(`/${created.id}/sub-assign`, { membershipId: agentMembershipId }).expect(403);
    const lost = await partnerApi(agentA).post(`/${created.id}/lost`, { reason: 'went_elsewhere', note: 'Took a loan from their own bank' }).expect(200);
    expect(lost.body).toMatchObject({ assignment: { status: 'completed', reason: 'lead_lost' }, lead: { status: 'lost' }, availableActions: [] });
  });

  it('sends declined and returned leads to the next CA, then to ops', async () => {
    const created = await lead('Ishita Kapoor');
    await route(created.id);
    await partnerApi(ownerA).post(`/${created.id}/decline`, { reason: 'other' }).expect(400);
    expect((await partnerApi(ownerA).post(`/${created.id}/decline`, { reason: 'capacity_full' }).expect(200)).body.status).toBe('declined');

    await partnerApi(ownerB).post(`/${created.id}/accept`).expect(200);
    const returned = await partnerApi(ownerB).post(`/${created.id}/return`, { reason: 'unreachable', note: 'Five calls, no answer' }).expect(200);
    expect(returned.body.status).toBe('returned');
    const detail = await t.api().get(`/v1/ops/leads/${created.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(detail.body.status).toBe('new');
    expect((await route(created.id)).outcome).toBe('no_candidate');
  });

  it('takes the lead back from the CA when ops closes it or consent is withdrawn', async () => {
    const closed = await lead('Jatin Arora');
    await route(closed.id);
    await partnerApi(ownerA).post(`/${closed.id}/accept`).expect(200);
    await t.api().post(`/v1/ops/leads/${closed.id}/disqualify`).set(bearer(ops.accessToken)).send({ reason: 'not_interested' }).expect(409);
    await t.api().post(`/v1/ops/leads/${closed.id}/lose`).set(bearer(ops.accessToken)).send({ reason: 'not_interested', note: 'Called ops to cancel' }).expect(200);
    await partnerApi(ownerA).get(`/${closed.id}`).expect(404);
    const reasons = (await t.prisma.leadAssignment.findMany({ where: { leadId: closed.id }, orderBy: { reason: 'asc' } })).map((row) => [row.status, row.reason]);
    expect(reasons).toEqual([['revoked', 'accepted_by_another_partner'], ['revoked', 'lead_status_changed']]);

    const withdrawn = await lead('Kavya Menon');
    await route(withdrawn.id);
    await partnerApi(ownerB).post(`/${withdrawn.id}/accept`).expect(200);
    await t.api().post(`/v1/ops/parties/${withdrawn.party.id}/consents`).set(bearer(ops.accessToken)).send({ channel: 'ops_call', evidence: 'Asked us on a call not to share with Bansal & Bedi', items: [{ purpose: 'partner_sharing', granted: false, organizationIds: [firmB] }] }).expect(201);
    await t.app.get(ClsService).run(() => t.app.get(LeadService).refreshConsentStatus(withdrawn.party.id));
    await partnerApi(ownerB).get(`/${withdrawn.id}`).expect(404);
    const after = await t.api().get(`/v1/ops/leads/${withdrawn.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(after.body.status).toBe('new');
    expect(after.body.assignments.find((row: { organization: { id: string } }) => row.organization.id === firmB)).toMatchObject({ status: 'revoked', reason: 'consent_withdrawn' });

    const late = await lead('Lalit Bose');
    const offered = await route(late.id);
    await t.prisma.leadAssignment.updateMany({ where: { id: { in: offered.assignments.map((row: { id: string }) => row.id) } }, data: { respondBy: new Date(Date.now() - 1_000) } });
    const missed = await partnerApi(ownerA).post(`/${late.id}/accept`).expect(409);
    expect(missed.body.details).toMatchObject({ reason: 'accept_sla_missed' });
  });
});
