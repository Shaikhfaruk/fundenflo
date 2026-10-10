import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { TEST_OTP_CODE } from './support/test.constants.js';

const LAKH = 100_000 * 100;

const pdf = (body: string) => Buffer.from(`%PDF-1.7\n${body}\n%%EOF\n`, 'latin1');

const allGranted = [
  { purpose: 'ai_documents', granted: true },
  { purpose: 'credit_bureau', granted: true },
  { purpose: 'lender_sharing', granted: true },
];

describe('application consents, co-applicants and PAN verification', () => {
  let t: TestApp;
  let borrower: AuthResult;
  let ops: StaffSession;
  let templateVersionId: string;

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    delete: (path: string) => t.api().delete(`/v1${path}`).set(bearer(session.accessToken)),
  });

  const startApplication = async (session: AuthResult, body: Record<string, unknown>) => {
    const created = await t.api().post('/v1/applications').set(bearer(session.accessToken)).send(body).expect(201);
    await t.api().patch(`/v1/applications/${created.body.id}/requirement`).set(bearer(session.accessToken)).set('If-Match', `"${created.body.version}"`).send({ purpose: 'expansion', amountPaise: 25 * LAKH, tenureMonths: 36, city: 'Gurgaon' }).expect(200);
    await t.api().put(`/v1/applications/${created.body.id}/answers`).set(bearer(session.accessToken)).send({ answers: [{ questionKey: 'business_age', value: '1-3' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    return created.body as { id: string; borrowerProfileId: string; party: { id: string }; actingParty: { id: string } };
  };

  beforeAll(async () => {
    t = await startTestApp();
    borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    ops = await createStaffSession(t, Role.ops_lead, 'Naveen Pillai');
    templateVersionId = (await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200)).body.versionId;
  });

  afterAll(async () => {
    await t.close();
  });

  it('records the applicant consent on the application and moves the case to documents_pending', async () => {
    const application = await startApplication(borrower, { segment: 'msme', subSegment: 'proprietorship', businessName: 'Pillai Spices', category: 'business' });
    const partial = await as(borrower).post(`/applications/${application.id}/consents`, { templateVersionId, items: [{ purpose: 'ai_documents', granted: false }, { purpose: 'credit_bureau', granted: true }] }).expect(200);
    expect(partial.body).toMatchObject({ missingRequired: ['ai_documents'], application: { status: 'pre_screened', journeyStage: 'consent' } });
    const consented = await as(borrower).post(`/applications/${application.id}/consents`, { templateVersionId, items: allGranted }).expect(200);
    expect(consented.body).toMatchObject({ missingRequired: [], application: { status: 'documents_pending', journeyStage: 'documents' } });
    expect(await t.prisma.consentRecord.count({ where: { applicationId: application.id, partyId: application.actingParty.id } })).toBe(5);

    const parties = await as(borrower).get(`/applications/${application.id}/parties`).expect(200);
    expect(parties.body.items.map((item: { role: string; consentStatus: string }) => [item.role, item.consentStatus])).toEqual([['borrower', 'granted'], ['applicant', 'granted']]);
    expect((await as(ops).post(`/applications/${application.id}/consents`, { templateVersionId, items: allGranted }).expect(403)).body.code).toBe('CONTEXT_NOT_ALLOWED');
  });

  it('adds a co-applicant whose OTP consent unblocks the journey', async () => {
    const owner = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const application = await startApplication(owner, { segment: 'msme', subSegment: 'proprietorship', businessName: 'Kapoor Dairy', category: 'business' });
    await as(owner).post(`/applications/${application.id}/consents`, { templateVersionId, items: allGranted }).expect(200);

    const spouseMobile = randomMobile();
    const added = await as(owner).post(`/applications/${application.id}/parties`, { role: 'co_applicant', name: 'Meena Kapoor', mobile: spouseMobile, relationship: 'spouse' }).expect(201);
    expect(added.body).toMatchObject({ role: 'co_applicant', relationship: 'spouse', consentStatus: 'pending', party: { displayName: 'Meena Kapoor' } });
    expect(added.body.mobile).toMatch(/^\+91 \d{2}•+\d{3}$/);
    await as(owner).post(`/applications/${application.id}/parties`, { role: 'guarantor', name: 'Meena Kapoor', mobile: spouseMobile }).expect(409);
    await as(owner).post(`/applications/${application.id}/parties`, { role: 'guarantor', name: 'Someone', mobile: '12' }).expect(400);
    const brother = await as(owner).post(`/applications/${application.id}/parties`, { role: 'guarantor', name: 'Vikram Kapoor', mobile: randomMobile(), relationship: 'sibling' }).expect(201);

    const blocked = await as(owner).get(`/applications/${application.id}/next-step`).expect(200);
    expect(blocked.body).toMatchObject({ stage: 'consent', blockers: [{ code: 'parties_consent_pending', details: [added.body.id, brother.body.id] }] });

    const sent = await as(owner).post(`/applications/${application.id}/parties/${added.body.id}/consent-otp`).expect(200);
    expect(sent.body).toMatchObject({ recipient: added.body.mobile, template: { versionId: templateVersionId } });
    await as(owner).post(`/applications/${application.id}/parties/${brother.body.id}/consent-otp/verify`, { challengeId: sent.body.challengeId, code: TEST_OTP_CODE, items: allGranted }).expect(410);
    expect((await as(owner).post(`/applications/${application.id}/parties/${added.body.id}/consent-otp/verify`, { challengeId: sent.body.challengeId, code: '000000', items: allGranted }).expect(401)).body.code).toBe('OTP_INVALID');
    const confirmed = await as(owner).post(`/applications/${application.id}/parties/${added.body.id}/consent-otp/verify`, { challengeId: sent.body.challengeId, code: TEST_OTP_CODE, items: allGranted }).expect(200);
    expect(confirmed.body).toMatchObject({ missingRequired: [], party: { consentStatus: 'granted' } });
    const record = await t.prisma.consentRecord.findFirstOrThrow({ where: { applicationId: application.id, partyId: added.body.party.id, purposeKey: 'credit_bureau' } });
    expect(record).toMatchObject({ granted: true, channel: 'app', templateVersionId });
    expect(record.evidence).toContain('One-time code');
    await as(owner).post(`/applications/${application.id}/parties/${added.body.id}/consent-otp`).expect(409);

    expect((await as(owner).get(`/applications/${application.id}/next-step`).expect(200)).body.blockers[0].details).toEqual([brother.body.id]);
    await as(owner).delete(`/applications/${application.id}/parties/${brother.body.id}`).expect(204);
    await as(owner).delete(`/applications/${application.id}/parties/${brother.body.id}`).expect(409);
    expect((await as(owner).get(`/applications/${application.id}/next-step`).expect(200)).body.stage).toBe('documents');
    const timeline = await as(owner).get(`/applications/${application.id}/timeline`).expect(200);
    expect(timeline.body.items.map((event: { type: string }) => event.type)).toEqual(expect.arrayContaining(['party_added', 'party_removed', 'consent_recorded']));
    await as(borrower).post(`/applications/${application.id}/parties`, { role: 'guarantor', name: 'Intruder', mobile: randomMobile() }).expect(404);
  });

  it('verifies the PAN of the right party and unblocks verify_details', async () => {
    const owner = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const application = await startApplication(owner, { segment: 'msme', subSegment: 'proprietorship', businessName: 'Rana Hardware', category: 'business' });
    await as(owner).post(`/applications/${application.id}/consents`, { templateVersionId, items: allGranted }).expect(200);
    for (const [documentType, name] of [['bank_statement', 'statement.pdf'], ['itr', 'itr.pdf']]) {
      await t.api().post('/v1/documents').set(bearer(owner.accessToken)).field('documentType', documentType as string).field('applicationId', application.id).attach('file', pdf(`Rana Hardware ${documentType}`), { filename: name as string, contentType: 'application/pdf' }).expect(201);
    }
    expect((await as(owner).get(`/applications/${application.id}/next-step`).expect(200)).body).toMatchObject({ stage: 'verify_details', blockers: [{ code: 'details_unverified' }] });

    const path = `/borrower-profiles/${application.borrowerProfileId}/kyc/pan`;
    expect((await as(owner).get(`/borrower-profiles/${application.borrowerProfileId}`).expect(200)).body.kyc).toEqual({ panHolder: 'P', pan: null });
    expect((await as(owner).post(path, { pan: 'ABCCR1234F', name: 'Suresh Rana' }).expect(400)).body.details[0].code).toBe('holder_mismatch');
    expect((await as(owner).post(path, { pan: 'ABCPR1234Z', name: 'Suresh Rana' }).expect(400)).body.details[0].code).toBe('not_found');
    await as(owner).post(path, { pan: 'not-a-pan' }).expect(400);
    const verified = await as(owner).post(path, { pan: 'abcpr1234f', name: 'Suresh Rana' }).expect(200);
    expect(verified.body).toMatchObject({ pan: 'ABCPR••••F', verified: true, nameMatch: true, partyId: application.actingParty.id, provider: 'stub' });
    const stored = await t.prisma.partyIdentifier.findFirstOrThrow({ where: { partyId: application.actingParty.id, type: 'pan' } });
    expect(stored.valueEnc).toMatch(/^v1:/);
    expect(stored.verifiedAt).not.toBeNull();
    expect((await as(owner).get(`/borrower-profiles/${application.borrowerProfileId}`).expect(200)).body.kyc).toEqual({ panHolder: 'P', pan: { masked: 'ABCPR••••F', verified: true, verifiedAt: expect.any(String) } });
    expect((await as(owner).get(`/applications/${application.id}/next-step`).expect(200)).body).toMatchObject({ stage: 'score', completed: expect.arrayContaining(['verify_details']) });

    const other = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const profile = await as(other).post('/borrower-profiles', { segment: 'individual', subSegment: 'salaried' }).expect(201);
    expect((await as(other).post(`/borrower-profiles/${profile.body.id}/kyc/pan`, { pan: 'ABCPR1234F', name: 'Suresh Rana' }).expect(409)).body.code).toBe('IDENTIFIER_IN_USE');
    const unmatched = await as(other).post(`/borrower-profiles/${profile.body.id}/kyc/pan`, { pan: 'BCDPK5678G', name: 'Kiran Kumar' }).expect(200);
    expect(unmatched.body).toMatchObject({ verified: true, nameMatch: true });
    const msmeNoType = await as(other).post('/borrower-profiles', { segment: 'msme', businessName: 'Kumar Tools' }).expect(201);
    expect((await as(other).post(`/borrower-profiles/${msmeNoType.body.id}/kyc/pan`, { pan: 'BCDFK5678G' }).expect(400)).body.details[0].path).toBe('subSegment');
    expect((await as(other).get(`/borrower-profiles/${msmeNoType.body.id}`).expect(200)).body.kyc).toEqual({ panHolder: null, pan: null });
    await as(borrower).post(`/borrower-profiles/${profile.body.id}/kyc/pan`, { pan: 'CDEPK5678H', name: 'Kiran Kumar' }).expect(404);
  });
});
