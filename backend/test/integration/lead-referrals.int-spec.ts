import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MINUTE_MS } from '../../src/common/constants/time.constants.js';
import { Role } from '../../src/common/enums/db.enums.js';
import type { DomainEventEnvelope } from '../../src/common/events/domain-event.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { LeadNotificationService } from '../../src/modules/leads/application/lead-notification.service.js';
import { LeadService } from '../../src/modules/leads/application/lead.service.js';
import { SlaService } from '../../src/modules/sla/application/sla.service.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

describe('partner referrals, CA edits, offline conversions and lead notifications', () => {
  let t: TestApp;
  let ops: StaffSession;
  let checker: StaffSession;
  let firmA: string;
  let ownerA: AuthResult;
  let ownerB: AuthResult;
  let templateVersionId: string;

  const inContext = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);

  const partner = (session: AuthResult) => ({
    get: (path: string) => t.api().get(`/v1/partner${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1/partner${path}`).set(bearer(session.accessToken)).send(body),
  });

  const refer = (session: AuthResult, body: Record<string, unknown>) =>
    partner(session).post('/leads', { name: 'Tarun Malhotra', category: 'business', city: 'Gurgaon', ...body });

  const consent = () => ({ templateVersionId, items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] });

  const envelope = async (name: string, where: Record<string, unknown>): Promise<DomainEventEnvelope> => {
    const rows = await t.prisma.outboxEvent.findMany({ where: { eventName: name }, orderBy: { occurredAt: 'desc' }, take: 50 });
    const row = rows.find((candidate) => Object.entries(where).every(([key, value]) => (candidate.payload as Record<string, unknown>)[key] === value));
    if (!row) throw new Error(`no ${name} event`);
    return { id: row.id, name: row.eventName as DomainEventEnvelope['name'], aggregateType: row.aggregateType, aggregateId: row.aggregateId, payload: row.payload as Record<string, unknown>, actor: null, requestId: null, occurredAt: row.occurredAt.toISOString() };
  };

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Uma Krishnan');
    checker = await createStaffSession(t, Role.ops_lead, 'Vikram Sethi');
    const compliance = await createStaffSession(t, Role.compliance_officer, 'Wahida Rahman');
    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    firmA = await createPartnerFirm(t, { name: 'Anand Chartered Accountants', cityId: gurugramId, signedUpByUserId: ops.user.id });
    const firmB = await createPartnerFirm(t, { name: 'Bhatia Finance Partners', cityId: gurugramId, signedUpByUserId: ops.user.id });
    ownerA = await createPartnerSession(t, firmA);
    ownerB = await createPartnerSession(t, firmB);

    const template = await t.api().post('/v1/admin/consent-templates').set(bearer(compliance.accessToken)).send({
      key: 'partner_referral_spec',
      name: { en: 'Partner Referral Consent' },
      content: {
        items: [
          { purpose: 'contact', required: true, title: { en: 'Call Me About My Loan' }, details: { en: 'My CA or FundenFlo may call me about this enquiry.' } },
          { purpose: 'partner_sharing', required: true, title: { en: 'Share With My CA' }, details: { en: 'My enquiry is shared with the CA who referred me.' } },
        ],
      },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/consent-templates/${template.body.id}/versions/1/submit`).set(bearer(compliance.accessToken)).send({ reason: 'Partner referrals' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(ops.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/consent-templates/${template.body.id}/versions/1/publish`).set(bearer(compliance.accessToken)).send({}).expect(200);
    templateVersionId = (await t.api().get('/v1/catalog/consent-templates').query({ context: 'partner_referral_spec' }).expect(200)).body.versionId;
  });

  afterAll(async () => {
    await t.close();
  });

  it('sends a consented referral straight to the referring CA and protects it from other firms', async () => {
    const mobile = randomMobile();
    const referred = await refer(ownerA, { mobile, consent: consent() }).expect(201);
    expect(referred.body).toMatchObject({ assigned: true, consentRequested: false, lead: { status: 'in_progress', consentStatus: 'ok' } });
    const leadId = referred.body.lead.id;

    const detail = await partner(ownerA).get(`/leads/${leadId}`).expect(200);
    expect(detail.body).toMatchObject({ assignment: { status: 'accepted', strategy: 'referral' }, lead: { name: 'Tarun Malhotra' } });
    const lead = await t.api().get(`/v1/ops/leads/${leadId}`).set(bearer(ops.accessToken)).expect(200);
    expect(lead.body.source.key).toBe('partner_referral');
    const consents = await t.api().get(`/v1/ops/parties/${lead.body.party.id}/consents`).set(bearer(ops.accessToken)).expect(200);
    expect(consents.body.items.find((item: { purpose: string }) => item.purpose === 'partner_sharing')).toMatchObject({ granted: true, everyOrganization: false, organizationIds: [firmA], channel: 'partner_assisted' });

    const conflict = await refer(ownerB, { mobile, consent: consent() }).expect(409);
    expect(conflict.body.code).toBe('LEAD_PROTECTED');
    const referrals = await partner(ownerA).get('/referrals').expect(200);
    expect(referrals.body.items[0]).toMatchObject({ lead: { id: leadId, name: 'Tarun Malhotra' } });
  });

  it('waits for consent on a referral without it, then offers the lead to the referring CA ahead of the rules', async () => {
    const referred = await refer(ownerA, { mobile: randomMobile(), name: 'Usha Bajaj', requestConsent: false }).expect(201);
    expect(referred.body).toMatchObject({ assigned: false, consentRequested: false, lead: { consentStatus: 'pending' } });
    const leadId = referred.body.lead.id;
    const lead = await t.api().get(`/v1/ops/leads/${leadId}`).set(bearer(ops.accessToken)).expect(200);
    await t.api().post(`/v1/ops/parties/${lead.body.party.id}/consents`).set(bearer(ops.accessToken)).send({ channel: 'ops_call', evidence: 'Confirmed on a call with the borrower', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] }).expect(201);
    await inContext(() => t.app.get(LeadService).refreshConsentStatus(lead.body.party.id));
    const simulated = await t.api().post('/v1/admin/routing-rules/simulate').set(bearer(ops.accessToken)).send({ leadId }).expect(200);
    expect(simulated.body).toMatchObject({ outcome: 'offered', referral: true, candidates: [firmA] });
    const routed = await t.api().post(`/v1/ops/leads/${leadId}/route`).set(bearer(ops.accessToken)).expect(200);
    expect(routed.body).toMatchObject({ outcome: 'offered', referral: true, rule: null });
    expect(routed.body.assignments[0].organizationId).toBe(firmA);

    await partner(ownerA).post(`/leads/${leadId}/accept`).expect(200);
    const offered = await envelope('lead.assignment.offered', { assignmentId: routed.body.assignments[0].id });
    expect(await inContext(() => t.app.get(LeadNotificationService).handle(offered))).toBe(1);
    const delivery = await t.prisma.notificationDelivery.findFirst({ where: { templateKey: 'lead.offered' }, orderBy: { id: 'desc' } });
    expect(delivery).toMatchObject({ channel: 'sms', status: 'queued' });
  });

  it('lets the CA edit lead details with If-Match and report an offline conversion that ops verifies', async () => {
    const referred = await refer(ownerA, { mobile: randomMobile(), name: 'Vandana Iyer', consent: consent() }).expect(201);
    const leadId = referred.body.lead.id;
    const before = await partner(ownerA).get(`/leads/${leadId}`).expect(200);
    await t.api().patch(`/v1/partner/leads/${leadId}`).set(bearer(ownerA.accessToken)).send({ campaign: 'mine' }).expect(400);
    const edited = await t.api().patch(`/v1/partner/leads/${leadId}`).set(bearer(ownerA.accessToken)).set('If-Match', `"${before.body.lead.version}"`).send({ amountMinPaise: 1_500_000_00, tenureMonths: 36 }).expect(200);
    expect(edited.body.lead).toMatchObject({ tenureMonths: 36, amount: { minPaise: 1_500_000_00 } });
    await t.api().patch(`/v1/partner/leads/${leadId}`).set(bearer(ownerA.accessToken)).set('If-Match', `"${before.body.lead.version}"`).send({ tenureMonths: 48 }).expect(409);

    const report = { lenderName: 'Haryana State Co-operative Bank', sanctionedAmountPaise: 1_400_000_00, disbursedAmountPaise: 1_400_000_00, sanctionedOn: '2026-10-01', disbursedOn: '2026-10-05', loanAccountRef: 'HSCB-88123' };
    await partner(ownerA).post(`/leads/${leadId}/offline-conversion`, { ...report, disbursedOn: undefined }).expect(400);
    const reported = await partner(ownerA).post(`/leads/${leadId}/offline-conversion`, report).expect(201);
    expect(reported.body).toMatchObject({ status: 'reported', sanctionedAmountPaise: 1_400_000_00, disbursedOn: '2026-10-05' });
    await partner(ownerA).post(`/leads/${leadId}/offline-conversion`, report).expect(409);

    const queue = await t.api().get('/v1/ops/offline-conversions').set(bearer(ops.accessToken)).expect(200);
    expect(queue.body.items.map((item: { id: string }) => item.id)).toContain(reported.body.id);
    await t.api().post(`/v1/ops/offline-conversions/${reported.body.id}/decide`).set(bearer(ops.accessToken)).send({ decision: 'reject' }).expect(400);
    const verified = await t.api().post(`/v1/ops/offline-conversions/${reported.body.id}/decide`).set(bearer(checker.accessToken)).send({ decision: 'verify', note: 'Sanction letter checked' }).expect(200);
    expect(verified.body).toMatchObject({ status: 'verified', decisionNote: 'Sanction letter checked' });
    await t.api().post(`/v1/ops/offline-conversions/${reported.body.id}/decide`).set(bearer(checker.accessToken)).send({ decision: 'verify' }).expect(409);

    const after = await partner(ownerA).get(`/leads/${leadId}`).expect(200);
    expect(after.body).toMatchObject({ assignment: { status: 'completed', reason: 'offline_conversion_verified' }, lead: { status: 'won' }, availableActions: [] });
    expect(after.body.conversions[0].status).toBe('verified');
  });

  it('rejects a doubtful conversion and keeps the CA working the lead', async () => {
    const referred = await refer(ownerA, { mobile: randomMobile(), name: 'Waseem Akhtar', consent: consent() }).expect(201);
    const leadId = referred.body.lead.id;
    const reported = await partner(ownerA).post(`/leads/${leadId}/offline-conversion`, { lenderName: 'Gurgaon Gramin Bank', sanctionedAmountPaise: 500_000_00, sanctionedOn: '2026-10-02' }).expect(201);
    const rejected = await t.api().post(`/v1/ops/offline-conversions/${reported.body.id}/decide`).set(bearer(ops.accessToken)).send({ decision: 'reject', note: 'Lender has no record of this sanction' }).expect(200);
    expect(rejected.body.status).toBe('rejected');
    const after = await partner(ownerA).get(`/leads/${leadId}`).expect(200);
    expect(after.body.lead.status).toBe('in_progress');
    expect(after.body.availableActions).toContain('offline_conversion');
  });

  it('notifies ops of a missed first contact and the assignee of a follow-up that is due', async () => {
    const referred = await refer(ownerA, { mobile: randomMobile(), name: 'Yamini Rao', consent: consent() }).expect(201);
    const leadId = referred.body.lead.id;
    const detail = await partner(ownerA).get(`/leads/${leadId}`).expect(200);
    await inContext(() => t.app.get(SlaService).sweep(new Date(Date.parse(detail.body.assignment.firstContactBy) + 1_000)));
    const breached = await envelope('lead.sla_breached', { assignmentId: detail.body.assignment.id });
    expect(await inContext(() => t.app.get(LeadNotificationService).handle(breached))).toBeGreaterThanOrEqual(1);
    expect(await t.prisma.notificationDelivery.count({ where: { templateKey: 'lead.first_contact_missed', channel: 'email' } })).toBeGreaterThanOrEqual(1);

    const followUp = await partner(ownerA).post(`/leads/${leadId}/follow-ups`, { dueAt: new Date(Date.now() + 20 * MINUTE_MS).toISOString(), note: 'Call about the sanction letter' }).expect(201);
    await inContext(() => t.app.get(SlaService).sweep(new Date()));
    const due = await envelope('follow_up.due', { followUpId: followUp.body.id });
    expect(await inContext(() => t.app.get(LeadNotificationService).handle(due))).toBe(1);
    expect(await t.prisma.notificationDelivery.count({ where: { templateKey: 'follow_up.due' } })).toBeGreaterThanOrEqual(1);
  });
});
