import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { TEST_OTP_CODE } from './support/test.constants.js';

const LAKH = 100_000 * 100;

const allGranted = [
  { purpose: 'ai_documents', granted: true },
  { purpose: 'credit_bureau', granted: true },
  { purpose: 'lender_sharing', granted: true },
];

describe('partner-filed borrowers and applications, lead conversion and the ops case view', () => {
  let t: TestApp;
  let ops: StaffSession;
  let firmA: string;
  let firmB: string;
  let ownerA: AuthResult;
  let ownerB: AuthResult;

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string, query: Record<string, string> = {}) => t.api().get(`/v1${path}`).query(query).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    put: (path: string, body: Record<string, unknown>) => t.api().put(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version: number) => t.api().patch(`/v1${path}`).set(bearer(session.accessToken)).set('If-Match', `"${version}"`).send(body),
  });

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Rekha Menon');
    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    firmA = await createPartnerFirm(t, { name: 'Arora Tax Consultants', cityId: gurugramId, signedUpByUserId: ops.user.id });
    firmB = await createPartnerFirm(t, { name: 'Bose Advisory', cityId: gurugramId, signedUpByUserId: ops.user.id });
    ownerA = await createPartnerSession(t, firmA);
    ownerB = await createPartnerSession(t, firmB);
  });

  afterAll(async () => {
    await t.close();
  });

  it('files an application for a new borrower, takes consent by OTP and hands the case to the borrower', async () => {
    const mobile = randomMobile();
    const borrower = await as(ownerA).post('/partner/borrowers', { name: 'Gaurav Arora', mobile, segment: 'msme', subSegment: 'proprietorship', businessName: 'Arora Garments' }).expect(201);
    expect(borrower.body).toMatchObject({ channel: 'partner', partnerOrganizationId: firmA, party: { kind: 'business', displayName: 'Arora Garments' }, actingParty: { displayName: 'Gaurav Arora' }, personOutcome: 'created' });
    const again = await as(ownerA).post('/partner/borrowers', { name: 'Gaurav Arora', mobile, segment: 'msme', subSegment: 'proprietorship', businessName: 'Arora Garments' }).expect(201);
    expect(again.body.id).toBe(borrower.body.id);
    expect((await as(ownerB).post('/partner/borrowers', { name: 'Gaurav Arora', mobile, segment: 'msme', subSegment: 'proprietorship', businessName: 'Arora Garments' }).expect(409)).body.code).toBe('BORROWER_ALREADY_REGISTERED');

    const created = await as(ownerA).post('/partner/applications', { borrowerProfileId: borrower.body.id, category: 'business' }).expect(201);
    expect(created.body).toMatchObject({ channel: 'partner', partnerOrganizationId: firmA, status: 'draft', actingParty: { displayName: 'Gaurav Arora' } });
    const id: string = created.body.id;
    await as(ownerB).post('/partner/applications', { borrowerProfileId: borrower.body.id }).expect(404);
    await as(ownerA).patch(`/applications/${id}/requirement`, { purpose: 'expansion', amountPaise: 30 * LAKH, tenureMonths: 36, city: 'Gurgaon' }, created.body.version).expect(200);
    await as(ownerA).put(`/applications/${id}/answers`, { answers: [{ questionKey: 'business_age', value: '3-5' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    expect((await t.prisma.answer.findFirstOrThrow({ where: { applicationId: id, questionKey: 'business_age' } })).channel).toBe('partner');

    const sent = await as(ownerA).post(`/partner/applications/${id}/borrower-consent/send`).expect(200);
    expect(sent.body.recipient).toMatch(/^\+91 /);
    await as(ownerB).post(`/partner/applications/${id}/borrower-consent/send`).expect(404);
    const consented = await as(ownerA).post(`/partner/applications/${id}/borrower-consent/verify`, { challengeId: sent.body.challengeId, code: TEST_OTP_CODE, items: allGranted }).expect(200);
    expect(consented.body).toMatchObject({ missingRequired: [], application: { status: 'documents_pending', journeyStage: 'documents' } });
    expect((await t.prisma.consentRecord.findFirstOrThrow({ where: { applicationId: id, purposeKey: 'ai_documents' } })).channel).toBe('partner_assisted');

    await t.api().post('/v1/documents').set(bearer(ownerA.accessToken)).field('documentType', 'bank_statement').field('applicationId', id).attach('file', Buffer.from('%PDF-1.7\nstatement\n%%EOF\n'), { filename: 'statement.pdf', contentType: 'application/pdf' }).expect(201);
    expect((await as(ownerA).get('/documents', { applicationId: id }).expect(200)).body.items).toHaveLength(1);
    expect((await as(ownerB).get('/documents', { applicationId: id }).expect(200)).body.items).toHaveLength(0);
    expect((await as(ownerA).get('/applications').expect(200)).body.items.map((item: { id: string }) => item.id)).toContain(id);
    await as(ownerB).get(`/applications/${id}`).expect(404);

    const person = await otpLogin(t, mobile, LoginAs.borrower);
    expect((await as(person).get('/applications').expect(200)).body.items.map((item: { id: string }) => item.id)).toEqual([id]);
    expect((await as(person).get('/documents', { applicationId: id }).expect(200)).body.items).toHaveLength(1);
  });

  it('respects referral protection and borrowers who manage their own profile', async () => {
    const protectedMobile = randomMobile();
    const lead = await as(ops).post('/ops/leads', { mobile: protectedMobile, name: 'Pooja Bose', segment: 'individual', category: 'personal', city: 'Gurgaon' }).expect(201);
    await t.prisma.leadAttribution.create({ data: { leadId: lead.body.id, organizationId: firmB, kind: 'referral', createdByUserId: ops.user.id, protectedUntil: new Date(Date.now() + 86_400_000) } });
    expect((await as(ownerA).post('/partner/borrowers', { name: 'Pooja Bose', mobile: protectedMobile, segment: 'individual' }).expect(409)).body.code).toBe('LEAD_PROTECTED');
    await as(ownerB).post('/partner/borrowers', { name: 'Pooja Bose', mobile: protectedMobile, segment: 'individual' }).expect(201);

    const selfMobile = randomMobile();
    const self = await otpLogin(t, selfMobile, LoginAs.borrower);
    await as(self).post('/borrower-profiles', { segment: 'individual', subSegment: 'salaried' }).expect(201);
    expect((await as(ownerA).post('/partner/borrowers', { name: 'Someone', mobile: selfMobile, segment: 'individual' }).expect(409)).body.code).toBe('BORROWER_ALREADY_REGISTERED');
    await as(ownerA).post('/partner/borrowers', { name: 'Bad Number', mobile: '12', segment: 'individual' }).expect(400);
    expect((await as(self).post('/partner/borrowers', { name: 'Self', mobile: randomMobile(), segment: 'individual' }).expect(403)).body.code).toBe('CONTEXT_NOT_ALLOWED');
  });

  it('starts an application from an accepted lead and credits the conversion', async () => {
    const mobile = randomMobile();
    const lead = await as(ops).post('/ops/leads', { mobile, name: 'Harish Bose', segment: 'msme', businessName: 'Bose Printers', category: 'business', city: 'Gurgaon', consent: { basis: 'consent', evidence: 'Agreed on a call', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] } }).expect(201);
    await as(ops).post(`/ops/leads/${lead.body.id}/assign`, { organizationId: firmB }).expect(201);
    await as(ownerA).post(`/partner/leads/${lead.body.id}/convert`, { subSegment: 'proprietorship' }).expect(404);
    await as(ownerB).post(`/partner/leads/${lead.body.id}/convert`, { subSegment: 'proprietorship' }).expect(409);
    await as(ownerB).post(`/partner/leads/${lead.body.id}/accept`).expect(200);
    const started = await as(ownerB).post(`/partner/leads/${lead.body.id}/convert`, { subSegment: 'proprietorship' }).expect(201);
    expect(started.body).toMatchObject({ channel: 'partner', partnerOrganizationId: firmB, leadId: lead.body.id, segmentKey: 'msme', categoryKey: 'business', party: { displayName: 'Bose Printers' }, actingParty: { displayName: 'Harish Bose' } });
    const converted = await as(ops).get(`/ops/leads/${lead.body.id}`).expect(200);
    expect(converted.body).toMatchObject({ status: 'converted', convertedApplicationId: started.body.id });
    expect(converted.body.assignments[0]).toMatchObject({ status: 'completed', reason: 'converted_to_application' });
  });

  it('limits agents to their own filings and gives ops a read-only case view', async () => {
    const agent = await createPartnerSession(t, firmA, Role.partner_agent);
    const otherAgent = await createPartnerSession(t, firmA, Role.partner_agent);
    const profile = await as(agent).post('/partner/borrowers', { name: 'Kavya Iyer', mobile: randomMobile(), segment: 'individual', subSegment: 'salaried' }).expect(201);
    const application = await as(agent).post('/partner/applications', { borrowerProfileId: profile.body.id, category: 'personal' }).expect(201);
    await as(ownerA).get(`/applications/${application.body.id}`).expect(200);
    await as(otherAgent).get(`/applications/${application.body.id}`).expect(404);
    await as(otherAgent).post('/partner/applications', { borrowerProfileId: profile.body.id }).expect(404);

    const list = await as(ops).get('/ops/cases', { channel: 'partner', partnerOrganizationId: firmA }).expect(200);
    expect(list.body.items.map((item: { id: string }) => item.id)).toContain(application.body.id);
    expect((await as(ops).get('/ops/cases', { q: application.body.ref.slice(0, 8) }).expect(200)).body.items.length).toBeGreaterThanOrEqual(1);
    expect((await as(ops).get('/ops/cases', { q: 'kavya iy' }).expect(200)).body.items.map((item: { id: string }) => item.id)).toContain(application.body.id);
    const detail = await as(ops).get(`/ops/cases/${application.body.id}`).expect(200);
    expect(detail.body).toMatchObject({ application: { id: application.body.id, channel: 'partner' }, parties: [{ role: 'borrower' }], documents: [], nextStep: { stage: 'requirement' } });
    expect(detail.body.consents.map((state: { purpose: string }) => state.purpose)).toContain('ai_documents');
    expect(detail.body.timeline[0]).toMatchObject({ type: 'created' });
    expect((await as(ownerA).get(`/ops/cases/${application.body.id}`).expect(403)).body.code).toBe('CONTEXT_NOT_ALLOWED');
  });
});
