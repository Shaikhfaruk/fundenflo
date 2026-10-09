import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { OrganizationType, PartyKind, Role } from '../../src/common/enums/db.enums.js';
import { ConsentService } from '../../src/modules/consents/application/consent.service.js';
import { bearer, createOrganization, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

type ConsentView = { purpose: string; granted: boolean; organizationIds: string[]; everyOrganization: boolean };

const find = (items: ConsentView[], purpose: string) => items.find((item) => item.purpose === purpose);

describe('consents', () => {
  let t: TestApp;
  let ops: StaffSession;
  let compliance: StaffSession;
  let borrowerToken: string;
  let journeyVersionId: string;
  let partyId: string;

  const opsRecord = (body: Record<string, unknown>) => t.api().post(`/v1/ops/parties/${partyId}/consents`).set(bearer(ops.accessToken)).send(body);
  const inContext = <T>(work: (consents: ConsentService) => Promise<T>) => t.app.get(ClsService).run(() => work(t.app.get(ConsentService)));

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Karan Malhotra');
    compliance = await createStaffSession(t, Role.compliance_officer, 'Ritu Sharma');
    borrowerToken = (await otpLogin(t, randomMobile())).accessToken;
    partyId = (await t.prisma.party.create({ data: { kind: PartyKind.person, displayName: 'Suresh Yadav' } })).id;
  });

  afterAll(async () => {
    await t.close();
  });

  it('serves the journey consent template seeded from the app, with a hash per item', async () => {
    const template = await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200);
    journeyVersionId = template.body.versionId;
    expect(template.body.items.map((item: { purpose: string; required: boolean }) => `${item.purpose}:${item.required}`)).toEqual(['ai_documents:true', 'credit_bureau:false', 'lender_sharing:false']);
    expect(template.body.items[0]).toMatchObject({ title: 'Read My Documents With AI', summary: 'Required · To Calculate Your Financial Health Score', textHash: expect.any(String) });
    await t.api().get('/v1/catalog/consent-templates').query({ context: 'nonexistent' }).expect(404);
  });

  it('records a borrower\'s own consent against the exact template text, and lets them withdraw', async () => {
    const before = await t.api().get('/v1/me/consents').set(bearer(borrowerToken)).expect(200);
    expect(before.body.items).toHaveLength(7);
    expect(before.body.items.every((item: ConsentView) => !item.granted)).toBe(true);

    const notInTemplate = await t.api().post('/v1/me/consents').set(bearer(borrowerToken)).send({ templateVersionId: journeyVersionId, items: [{ purpose: 'marketing', granted: true }] }).expect(400);
    expect(notInTemplate.body.details[0].code).toBe('not_in_template');

    const partial = await t.api().post('/v1/me/consents').set(bearer(borrowerToken)).set('User-Agent', 'FundenFlo/0.1 (iOS 19)').send({
      templateVersionId: journeyVersionId,
      clientRecordedAt: '2026-10-09T10:00:00.000Z',
      items: [{ purpose: 'ai_documents', granted: false }, { purpose: 'credit_bureau', granted: true }, { purpose: 'lender_sharing', granted: true }],
    }).expect(201);
    expect(partial.body.missingRequired).toEqual(['ai_documents']);
    const template = await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200);
    expect(partial.body.records[1]).toMatchObject({ purpose: 'credit_bureau', granted: true, channel: 'app', textHash: template.body.items[1].textHash, locale: 'en', templateVersionId: journeyVersionId });
    const stored = await t.prisma.consentRecord.findUniqueOrThrow({ where: { id: partial.body.records[1].id } });
    expect(stored.userAgent).toBe('FundenFlo/0.1 (iOS 19)');
    expect(stored.recordedAt.getTime()).toBeGreaterThan(Date.parse('2026-10-09T10:00:00.000Z'));

    const complete = await t.api().post('/v1/me/consents').set(bearer(borrowerToken)).send({ templateVersionId: journeyVersionId, items: [{ purpose: 'ai_documents', granted: true }] }).expect(201);
    expect(complete.body.missingRequired).toEqual([]);

    await t.api().post('/v1/me/consents/lender_sharing/withdraw').set(bearer(borrowerToken)).send({}).expect(200);
    const after = await t.api().get('/v1/me/consents').set(bearer(borrowerToken)).expect(200);
    expect(find(after.body.items, 'lender_sharing')?.granted).toBe(false);
    expect(find(after.body.items, 'ai_documents')?.granted).toBe(true);
  });

  it('records backlog consent with evidence, enforces bases and partner scopes', async () => {
    const noEvidence = await opsRecord({ channel: 'import', items: [{ purpose: 'contact', granted: true }] }).expect(400);
    expect(noEvidence.body.details[0]).toMatchObject({ path: 'evidence', code: 'required' });
    const noTemplate = await opsRecord({ channel: 'web_form', items: [{ purpose: 'contact', granted: true }] }).expect(400);
    expect(noTemplate.body.details[0]).toMatchObject({ path: 'templateVersionId', code: 'required' });
    const wrongBasis = await opsRecord({ channel: 'ops_call', basis: 'legitimate_use', evidence: 'Existing customer enquiry, 2026-08-14', items: [{ purpose: 'partner_sharing', granted: true }] }).expect(400);
    expect(wrongBasis.body.details[0].code).toBe('basis_not_allowed');

    await opsRecord({ channel: 'import', evidence: 'Website form checkbox, 2026-08-14', items: [{ purpose: 'contact', granted: true }] }).expect(201);

    const partner = await createOrganization(t, OrganizationType.partner, 'Mehta & Associates CA');
    const otherPartner = await createOrganization(t, OrganizationType.partner, 'Iyer Tax Consultants');
    const lender = await createOrganization(t, OrganizationType.lender, 'Shivalik Finance');
    const wrongType = await opsRecord({ channel: 'ops_call', evidence: 'Agreed on call, 9 Oct', items: [{ purpose: 'partner_sharing', granted: true, organizationIds: [lender.id] }] }).expect(400);
    expect(wrongType.body.details[0]).toMatchObject({ path: 'items.0.organizationIds.0', code: 'unknown_organization' });
    const unscopable = await opsRecord({ channel: 'ops_call', evidence: 'Agreed on call, 9 Oct', items: [{ purpose: 'contact', granted: true, organizationIds: [partner.id] }] }).expect(400);
    expect(unscopable.body.details[0].code).toBe('not_allowed');

    await opsRecord({ channel: 'ops_call', evidence: 'Agreed on call to share with Mehta & Associates, 9 Oct', items: [{ purpose: 'partner_sharing', granted: true, organizationIds: [partner.id] }] }).expect(201);
    const current = await t.api().get(`/v1/ops/parties/${partyId}/consents`).set(bearer(ops.accessToken)).expect(200);
    expect(find(current.body.items, 'partner_sharing')).toMatchObject({ granted: true, everyOrganization: false, organizationIds: [partner.id] });
    expect(find(current.body.items, 'contact')).toMatchObject({ granted: true, basis: 'consent', channel: 'import' });

    expect(await inContext((consents) => consents.hasConsent(partyId, 'partner_sharing', { organizationId: partner.id }))).toBe(true);
    expect(await inContext((consents) => consents.hasConsent(partyId, 'partner_sharing', { organizationId: otherPartner.id }))).toBe(false);
    await expect(inContext((consents) => consents.assertConsent(partyId, 'lender_sharing'))).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });

    const history = await t.api().get(`/v1/ops/parties/${partyId}/consents/history`).query({ purpose: 'contact' }).set(bearer(ops.accessToken)).expect(200);
    expect(history.body.items[0]).toMatchObject({ purpose: 'contact', evidence: 'Website form checkbox, 2026-08-14', capturedByUserId: ops.user.id });
    await expect(t.prisma.$executeRaw`UPDATE consent_records SET granted = false WHERE party_id = ${partyId}::uuid`).rejects.toThrow(/append-only/);
    await expect(t.prisma.$executeRaw`DELETE FROM consent_records WHERE party_id = ${partyId}::uuid`).rejects.toThrow(/append-only/);
  });

  it('lets compliance define purposes with validity, and publish templates through maker-checker', async () => {
    await t.api().post('/v1/admin/consent-purposes').set(bearer(ops.accessToken)).send({ key: 'sms_offers', label: { en: 'Offers By SMS' }, allowedBases: ['consent'] }).expect(403);
    const scopeless = await t.api().post('/v1/admin/consent-purposes').set(bearer(compliance.accessToken)).send({ key: 'insurer_sharing', label: { en: 'Share With Insurers' }, scopeKind: 'organizations', allowedBases: ['consent'] }).expect(400);
    expect(scopeless.body.details[0]).toMatchObject({ path: 'scopeOrganizationType', code: 'required' });
    await t.api().post('/v1/admin/consent-purposes').set(bearer(compliance.accessToken)).send({ key: 'sms_offers', label: { en: 'Offers By SMS' }, allowedBases: ['consent'], validityDays: 365 }).expect(201);

    const created = await t.api().post('/v1/admin/consent-templates').set(bearer(compliance.accessToken)).send({
      key: 'lead_capture',
      name: { en: 'Lead Capture Consent' },
      content: {
        items: [
          { purpose: 'contact', required: true, title: { en: 'Call Me About My Loan' }, details: { en: 'FundenFlo or its partner may call or message you about this enquiry.' } },
          { purpose: 'sms_offers', title: { en: 'Send Me Offers By SMS' }, details: { en: 'Occasional offers by SMS. You can stop them any time.' } },
        ],
      },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/consent-templates/${created.body.id}/versions/1/submit`).set(bearer(compliance.accessToken)).send({ reason: 'Consent text for web lead forms' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(ops.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/consent-templates/${created.body.id}/versions/1/publish`).set(bearer(compliance.accessToken)).send({}).expect(200);

    const leadTemplate = await t.api().get('/v1/catalog/consent-templates').query({ context: 'lead_capture' }).expect(200);
    const recorded = await opsRecord({ channel: 'web_form', templateVersionId: leadTemplate.body.versionId, items: [{ purpose: 'sms_offers', granted: true }] }).expect(201);
    const expiresAt = Date.parse(recorded.body.records[0].expiresAt);
    expect(expiresAt - Date.now()).toBeGreaterThan(364 * 24 * 3_600_000);
    expect(recorded.body.missingRequired).toEqual([]);
  });
});
