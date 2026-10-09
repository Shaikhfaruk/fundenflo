import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '../../src/common/enums/db.enums.js';
import { CipherPurpose } from '../../src/infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../src/infrastructure/crypto/field-cipher.service.js';
import { QueueName } from '../../src/infrastructure/queue/queue-names.js';
import { QueueRegistry } from '../../src/infrastructure/queue/queue-registry.service.js';
import { LeadCaptureService } from '../../src/modules/leads/application/lead-capture.service.js';
import { LeadSourceService } from '../../src/modules/leads/application/lead-source.service.js';
import { LeadService } from '../../src/modules/leads/application/lead.service.js';
import type { DispatchJob, DispatchPayload } from '../../src/modules/notifications/application/notification.service.js';
import { NotificationTemplateKey } from '../../src/modules/notifications/domain/notification.constants.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

describe('lead consent requests, consent sync and app drop-offs', () => {
  let t: TestApp;
  let ops: StaffSession;
  let compliance: StaffSession;
  let leadId: string;
  let partyId: string;

  const inContext = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);

  const latestConsentLinkToken = async () => {
    const jobs = await t.app.get(QueueRegistry).get(QueueName.NotificationsDispatch).getJobs(['waiting', 'prioritized', 'delayed', 'active', 'completed', 'failed']);
    const job = jobs.filter((candidate) => candidate.name === NotificationTemplateKey.ConsentRequest).toSorted((left, right) => right.timestamp - left.timestamp)[0];
    if (!job) throw new Error('no consent request SMS was queued');
    const payload = t.app.get(FieldCipher).decryptJson<DispatchPayload>((job.data as DispatchJob).payload, CipherPurpose.NotificationPayload);
    return { token: new URL(String(payload.params.link)).searchParams.get('token') ?? '', payload };
  };

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Siddharth Rao');
    compliance = await createStaffSession(t, Role.compliance_officer, 'Neelam Joshi');
    const template = await t.api().post('/v1/admin/consent-templates').set(bearer(compliance.accessToken)).send({
      key: 'lead_followup',
      name: { en: 'Lead Follow-up Consent' },
      content: {
        items: [
          { purpose: 'contact', required: true, title: { en: 'Call Me About My Loan' }, details: { en: 'FundenFlo or its partner may call or message you about this enquiry.' } },
          { purpose: 'partner_sharing', required: true, title: { en: 'Share With A Partner CA' }, details: { en: 'Your enquiry may be shared with a verified FundenFlo partner.' } },
        ],
      },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/consent-templates/${template.body.id}/versions/1/submit`).set(bearer(compliance.accessToken)).send({ reason: 'Backlog consent link' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(ops.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/consent-templates/${template.body.id}/versions/1/publish`).set(bearer(compliance.accessToken)).send({}).expect(200);
    const lead = await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ name: 'Kavita Shah', mobile: randomMobile(), category: 'business' }).expect(201);
    leadId = lead.body.id;
    partyId = lead.body.party.id;
  });

  afterAll(async () => {
    await t.close();
  });

  it('sends a consent link by SMS and lets the person confirm against the exact template', async () => {
    const request = await t.api().post(`/v1/ops/leads/${leadId}/consent-request`).set(bearer(ops.accessToken)).send({ context: 'lead_followup' }).expect(201);
    expect(request.body).toMatchObject({ status: 'pending', channel: 'sms_link', leadId, recipient: expect.stringContaining('•') });
    const { token, payload } = await latestConsentLinkToken();
    expect(String(payload.params.link)).toMatch(/^https:\/\/consent\.fundenflo\.invalid\/c\?token=/);
    expect(payload.params.ref).toMatch(/^LD-/);

    const view = await t.api().get(`/v1/public/consent-requests/${token}`).expect(200);
    expect(view.body.template.items.map((item: { purpose: string }) => item.purpose)).toEqual(['contact', 'partner_sharing']);
    const confirmed = await t.api().post(`/v1/public/consent-requests/${token}`).send({ items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] }).expect(200);
    expect(confirmed.body.missingRequired).toEqual([]);
    await t.api().post(`/v1/public/consent-requests/${token}`).send({ items: [{ purpose: 'contact', granted: false }] }).expect(410);

    const records = await t.prisma.consentRecord.findMany({ where: { partyId, leadId } });
    expect(records.map((record) => `${record.purposeKey}:${record.channel}`).toSorted()).toEqual(['contact:sms_link', 'partner_sharing:sms_link']);
  });

  it('updates open leads when consent changes, which the worker does on consent events', async () => {
    const before = await t.api().get(`/v1/ops/leads/${leadId}`).set(bearer(ops.accessToken)).expect(200);
    expect(before.body.consentStatus).toBe('pending');
    expect(await inContext(() => t.app.get(LeadService).refreshConsentStatus(partyId))).toBe(1);
    const after = await t.api().get(`/v1/ops/leads/${leadId}`).set(bearer(ops.accessToken)).expect(200);
    expect(after.body).toMatchObject({ consentStatus: 'ok', qualityScore: before.body.qualityScore + 10 });
    expect(after.body.events.slice(0, 2).map((event: { type: string }) => event.type)).toEqual(['consent_changed', 'consent_requested']);
    expect(await inContext(() => t.app.get(LeadService).refreshConsentStatus(partyId))).toBe(0);

    await t.api().post(`/v1/ops/parties/${partyId}/consents`).set(bearer(ops.accessToken)).send({ channel: 'ops_call', items: [{ purpose: 'partner_sharing', granted: false }] }).expect(201);
    await inContext(() => t.app.get(LeadService).refreshConsentStatus(partyId));
    expect((await t.api().get(`/v1/ops/leads/${leadId}`).set(bearer(ops.accessToken)).expect(200)).body.consentStatus).toBe('withdrawn');
  });

  it('refuses links for people who must not be contacted, and expires old links', async () => {
    const lead = await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ name: 'Do Not Call', mobile: randomMobile() }).expect(201);
    await t.prisma.partyContact.updateMany({ where: { partyId: lead.body.party.id }, data: { doNotContact: true } });
    const blocked = await t.api().post(`/v1/ops/leads/${lead.body.id}/consent-request`).set(bearer(ops.accessToken)).send({ context: 'lead_followup' }).expect(400);
    expect(blocked.body.details[0].code).toBe('no_reachable_mobile');

    const other = await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ name: 'Late Reply', mobile: randomMobile() }).expect(201);
    const sent = await t.api().post(`/v1/ops/leads/${other.body.id}/consent-request`).set(bearer(ops.accessToken)).send({ context: 'lead_followup' }).expect(201);
    const { token } = await latestConsentLinkToken();
    await t.prisma.consentRequest.update({ where: { id: sent.body.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await t.api().get(`/v1/public/consent-requests/${token}`).expect(410).expect((response) => expect(response.body.code).toBe('CONSENT_LINK_INVALID'));
    expect((await t.prisma.consentRequest.findUniqueOrThrow({ where: { id: sent.body.id } })).status).toBe('expired');
    await t.api().post(`/v1/ops/leads/${other.body.id}/consent-request`).set(bearer(ops.accessToken)).send({ context: 'no_such_template' }).expect(404);
  });

  it('turns an app sign-up without a lead into an app drop-off lead once', async () => {
    const borrower = await otpLogin(t, randomMobile());
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: borrower.user.id } });
    const capture = () => inContext(async () => t.app.get(LeadCaptureService).captureDropoff(user.partyId, await t.app.get(LeadSourceService).activeByKey('app_dropoff')));
    const first = await capture();
    expect(first?.lead).toMatchObject({ source: { key: 'app_dropoff' }, status: 'new', consentStatus: 'pending', party: { id: user.partyId } });
    expect(first?.lead.events[0]).toMatchObject({ type: 'captured', actorType: 'system' });
    expect(await capture()).toBeNull();
  });
});
