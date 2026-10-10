import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

describe('borrower profiles and applications', () => {
  let t: TestApp;
  let borrower: AuthResult;
  let other: AuthResult;
  let ops: StaffSession;

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    put: (path: string, body: Record<string, unknown>) => t.api().put(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version?: number) => {
      const request = t.api().patch(`/v1${path}`).set(bearer(session.accessToken));
      return (version === undefined ? request : request.set('If-Match', `"${version}"`)).send(body);
    },
  });

  beforeAll(async () => {
    t = await startTestApp();
    borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    other = await otpLogin(t, randomMobile(), LoginAs.borrower);
    ops = await createStaffSession(t, Role.ops_lead, 'Farida Sheikh');
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates one borrower profile per party, with a business party for MSMEs', async () => {
    const business = await as(borrower).post('/borrower-profiles', { segment: 'msme', subSegment: 'proprietorship', businessName: 'Kapoor Electricals' }).expect(201);
    expect(business.body).toMatchObject({ segmentKey: 'msme', party: { kind: 'business', displayName: 'Kapoor Electricals' }, channel: 'direct' });
    const again = await as(borrower).post('/borrower-profiles', { segment: 'msme', businessName: 'kapoor electricals' }).expect(201);
    expect(again.body.id).toBe(business.body.id);
    const personal = await as(borrower).post('/borrower-profiles', { segment: 'individual', subSegment: 'salaried' }).expect(201);
    expect(personal.body.party.kind).toBe('person');
    await as(borrower).post('/borrower-profiles', { segment: 'msme' }).expect(400);
    await as(borrower).post('/borrower-profiles', { segment: 'individual', subSegment: 'llp' }).expect(400);
    expect((await as(borrower).get('/borrower-profiles').expect(200)).body.items).toHaveLength(2);
    expect((await as(other).get('/borrower-profiles').expect(200)).body.items).toHaveLength(0);
    await as(other).get(`/borrower-profiles/${business.body.id}`).expect(404);
  });

  it('walks an MSME application from requirement through pre-check to consent and documents', async () => {
    const created = await as(borrower).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName: 'Kapoor Electricals', category: 'business' }).expect(201);
    expect(created.body).toMatchObject({ status: 'draft', journeyStage: 'requirement', channel: 'direct', categoryKey: 'business', party: { kind: 'business' } });
    expect(created.body.ref).toMatch(/^AP-\d{2}-\d{6}$/);
    const id = created.body.id;

    await as(borrower).patch(`/applications/${id}/requirement`, { amountPaise: 1_000 }, created.body.version).expect(400);
    await as(borrower).patch(`/applications/${id}/requirement`, { tenureMonths: 7 }, created.body.version).expect(400);
    await as(borrower).patch(`/applications/${id}/requirement`, { purpose: 'spaceship' }, created.body.version).expect(400);
    const requirement = await as(borrower).patch(`/applications/${id}/requirement`, { purpose: 'expansion', amountPaise: 25 * LAKH, tenureMonths: 36, city: 'Gurgaon' }, created.body.version).expect(200);
    expect(requirement.body).toMatchObject({ amountPaise: 25 * LAKH, tenureMonths: 36, journeyStage: 'pre_check' });
    expect(requirement.body.location.cityId).not.toBeNull();
    expect(requirement.body.location.city).toMatchObject({ id: requirement.body.location.cityId, name: 'Gurugram', state: { name: 'Haryana' } });
    expect((await as(borrower).get(`/applications/${id}`).expect(200)).body.location.city.name).toBe('Gurugram');
    await as(borrower).patch(`/applications/${id}/requirement`, { tenureMonths: 24 }, created.body.version).expect(409);

    const step = await as(borrower).get(`/applications/${id}/next-step`).expect(200);
    expect(step.body).toMatchObject({ stage: 'pre_check', completed: ['category', 'requirement'], blockers: [{ code: 'questions_unanswered' }] });
    expect(step.body.blockers[0].details.toSorted((left: string, right: string) => left.localeCompare(right))).toEqual(['business_age', 'existing_emis', 'gst_registered', 'monthly_turnover']);
    const questions = await as(borrower).get(`/applications/${id}/questions`).expect(200);
    expect(questions.body.questions.map((item: { question: { key: string } }) => item.question.key)).toEqual(expect.arrayContaining(['business_age', 'monthly_turnover']));
    expect(questions.body.answers).toEqual([]);

    await as(borrower).put(`/applications/${id}/answers`, { answers: [{ questionKey: 'business_age', value: '1-3' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    await as(borrower).put(`/applications/${id}/answers`, { answers: [{ questionKey: 'business_age', value: '3-5' }] }).expect(200);
    const prefilled = (await as(borrower).get(`/applications/${id}/questions`).expect(200)).body.answers as Array<{ questionKey: string; value: unknown; answeredAt: string }>;
    expect(Object.fromEntries(prefilled.map((answer) => [answer.questionKey, answer.value]))).toEqual({ business_age: '3-5', monthly_turnover: '5-25L', existing_emis: 'no', gst_registered: 'yes' });
    const screened = await as(borrower).get(`/applications/${id}`).expect(200);
    expect(screened.body).toMatchObject({ status: 'pre_screened', journeyStage: 'consent' });
    expect(screened.body.pinnedVersions.preCheck).toHaveLength(1);
    expect((await as(borrower).get(`/applications/${id}/next-step`).expect(200)).body.blockers[0]).toMatchObject({ code: 'consent_missing', details: ['ai_documents'] });

    const template = await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200);
    await as(borrower).post('/me/consents', { templateVersionId: template.body.versionId, items: [{ purpose: 'ai_documents', granted: true }, { purpose: 'credit_bureau', granted: false }, { purpose: 'lender_sharing', granted: true }] }).expect(201);
    const documents = await as(borrower).get(`/applications/${id}/next-step`).expect(200);
    expect(documents.body).toMatchObject({ stage: 'documents', blockers: [{ code: 'documents_missing', details: ['bank_statement', 'income_proof'] }] });
    const checklist = await as(borrower).get(`/applications/${id}/document-checklist`).expect(200);
    expect(checklist.body.items.map((item: { key: string }) => item.key)).toEqual(['bank_statement', 'income_proof']);

    const timeline = await as(borrower).get(`/applications/${id}/timeline`).expect(200);
    expect(timeline.body.items.map((event: { type: string }) => event.type)).toEqual(expect.arrayContaining(['created', 'requirement_changed', 'answers_recorded', 'status_changed', 'stage_changed']));
    await as(other).get(`/applications/${id}`).expect(404);
    expect((await as(ops).get('/applications').expect(403)).body.code).toBe('CONTEXT_NOT_ALLOWED');

    const withdrawn = await as(borrower).post(`/applications/${id}/withdraw`, { reason: 'Got a loan from my bank' }).expect(200);
    expect(withdrawn.body).toMatchObject({ status: 'withdrawn', closeReason: 'Got a loan from my bank' });
    await as(borrower).patch(`/applications/${id}/requirement`, { tenureMonths: 24 }, withdrawn.body.version).expect(409);
    await as(borrower).post(`/applications/${id}/withdraw`, { reason: 'Again' }).expect(409);
  });

  it('converts an open lead when its person starts an application and credits the CA', async () => {
    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    const firm = await createPartnerFirm(t, { name: 'Gill Associates', cityId: gurugramId, signedUpByUserId: ops.user.id });
    const owner = await createPartnerSession(t, firm);
    const mobile = randomMobile();
    const lead = await as(ops).post('/ops/leads', { mobile, name: 'Harpreet Gill', segment: 'individual', category: 'personal', city: 'Gurgaon', consent: { basis: 'consent', evidence: 'Agreed on a call', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] } }).expect(201);
    await as(ops).post(`/ops/leads/${lead.body.id}/assign`, { organizationId: firm }).expect(201);
    await as(owner).post(`/partner/leads/${lead.body.id}/accept`).expect(200);

    const person = await otpLogin(t, mobile, LoginAs.borrower);
    const application = await as(person).post('/applications', { segment: 'individual', subSegment: 'salaried', category: 'personal' }).expect(201);
    expect(application.body.leadId).toBe(lead.body.id);
    const converted = await as(ops).get(`/ops/leads/${lead.body.id}`).expect(200);
    expect(converted.body).toMatchObject({ status: 'converted', convertedApplicationId: application.body.id });
    expect(converted.body.assignments[0]).toMatchObject({ status: 'completed', reason: 'converted_to_application' });
    const second = await as(person).post('/applications', { segment: 'individual', category: 'personal' }).expect(201);
    expect(second.body.leadId).toBeNull();
    await as(person).post(`/applications/${application.body.id}/withdraw`, { reason: 'Not needed any more' }).expect(200);
    expect((await as(ops).get(`/ops/leads/${lead.body.id}`).expect(200)).body).toMatchObject({ status: 'lost', lostReason: 'not_interested' });
  });
});
