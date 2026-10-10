import { randomInt } from 'node:crypto';

import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '../../src/common/enums/db.enums.js';
import { AnalysisService } from '../../src/modules/assessments/application/analysis.service.js';
import { DocumentScanService } from '../../src/modules/documents/application/document-scan.service.js';
import { SubmissionService } from '../../src/modules/submissions/application/submission.service.js';
import { bearer, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { TEST_OTP_CODE } from './support/test.constants.js';

const LAKH = 100_000 * 100;

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXY';

const randomPan = () => `ABCP${LETTERS[randomInt(0, LETTERS.length)]}${String(randomInt(0, 10_000)).padStart(4, '0')}${LETTERS[randomInt(0, LETTERS.length)]}`;

const PDF = Buffer.from('%PDF-1.7\nbank statement\n%%EOF\n');

const product = {
  category: 'business',
  segments: ['msme'],
  amountPaise: { min: 5 * LAKH, max: 50 * LAKH },
  tenureMonths: { min: 12, max: 60 },
  coverage: { states: ['06'] },
  eligibility: { hard: [{ id: 'gst', when: { attr: 'business.gst_registered', op: 'eq', value: true }, pass: { en: 'You are GST registered' } }], soft: [] },
  documents: [{ key: 'statement', documentTypes: ['bank_statement'], stage: 'assessment' }],
  pricingDisclosure: { en: 'From 14% a year, as per lender policy' },
};

const scoringModel = {
  scope: { segments: ['msme'] },
  attentionBelowPct: 60,
  bands: [{ min: 0, label: { en: 'Needs Work Before Matching' } }, { min: 40, label: { en: 'Fair — A Few Gaps To Close' } }, { min: 60, label: { en: 'Good — Ready For Funding' } }],
  factors: [
    { key: 'vintage', label: { en: 'Business Vintage' }, max: 10, method: 'linear', linear: { attr: 'business.vintage_months', from: 0, to: 60 } },
    { key: 'gst', label: { en: 'GST & ITR Consistency' }, max: 15, method: 'bands', missing: 'zero', bands: [{ when: { attr: 'business.gst_registered', op: 'eq', value: true }, points: 15 }] },
  ],
};

describe('compat /v0 for the current app', () => {
  let t: TestApp;
  let manager: StaffSession;
  let ops: StaffSession;
  let analyst: StaffSession;
  let lenderId: string;
  let scoringModelId: string;
  const mobile = randomMobile();

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);

  const staff = (session: StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version: number) => t.api().patch(`/v1${path}`).set(bearer(session.accessToken)).set('If-Match', `"${version}"`).send(body),
  });

  const publish = async (maker: StaffSession, resource: string, key: string, content: Record<string, unknown>, name: Record<string, string>) => {
    const created = await staff(maker).post(`/admin/${resource}`, { key, name, content }).expect(201);
    const submitted = await staff(maker).post(`/admin/${resource}/${created.body.id}/versions/1/submit`, { reason: 'Compat check' }).expect(200);
    await staff(ops).post(`/admin/change-requests/${submitted.body.changeRequest.id}/approve`).expect(200);
    await staff(maker).post(`/admin/${resource}/${created.body.id}/versions/1/publish`).expect(200);
    return created.body.id as string;
  };

  beforeAll(async () => {
    t = await startTestApp();
    manager = await createStaffSession(t, Role.lender_manager, 'Ishaan Batra');
    ops = await createStaffSession(t, Role.ops_lead, 'Ritu Arora');
    analyst = await createStaffSession(t, Role.credit_analyst, 'Varun Sethi');
    const lender = await staff(manager).post('/admin/lenders', { key: 'compat_lender', name: 'Compat Finance', kind: 'nbfc' }).expect(201);
    lenderId = lender.body.id;
    await staff(manager).patch(`/admin/lenders/${lenderId}`, { status: 'active' }, lender.body.version).expect(200);
    const agreement = await staff(manager).post(`/admin/lenders/${lenderId}/agreements`, { reference: 'CF-1', validFrom: new Date().toISOString().slice(0, 10) }).expect(201);
    await staff(manager).patch(`/admin/lenders/${lenderId}/agreements/${agreement.body.id}`, { status: 'active' }, agreement.body.version).expect(200);
    await publish(manager, 'lender-products', 'compat_lender.business', product, { en: 'Compat Business Loan' });
    scoringModelId = await publish(analyst, 'scoring-models', 'msme.compat', scoringModel, { en: 'Compat model' });
  });

  afterAll(async () => {
    const lender = await staff(manager).get(`/admin/lenders/${lenderId}`).expect(200);
    await staff(manager).patch(`/admin/lenders/${lenderId}`, { status: 'offboarded' }, lender.body.version).expect(200);
    await staff(analyst).post(`/admin/scoring-models/${scoringModelId}/versions/1/retire`, { reason: 'Compat check done' }).expect(200);
    await t.close();
  });

  it('runs the app journey from OTP to applying to a lender with the app request shapes', async () => {
    expect((await t.api().post('/v0/auth/otp/request').send({ mobile, countryCode: '+91' }).expect(200)).body.resendIn).toBeGreaterThan(0);
    const session = await t.api().post('/v0/auth/otp/verify').send({ mobile, otp: TEST_OTP_CODE }).expect(200);
    expect(session.body).toMatchObject({ token: session.body.accessToken, user: { mobile } });
    const app = {
      get: (path: string) => t.api().get(`/v0${path}`).set(bearer(session.body.token)),
      post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v0${path}`).set(bearer(session.body.token)).send(body),
    };

    const categories = await app.get('/loan/categories?entityType=msme').expect(200);
    expect(categories.body.categories).toContainEqual({ id: 'business', available: true });
    expect(categories.body.categories).toContainEqual({ id: 'invoice', available: false, reason: 'Not Yet Available In Your Area' });

    const requirement = await app.post('/loan/requirement', { entityType: 'msme', loanCategory: 'business', amount: 2_000_000, tenureYears: 3, location: 'Gurugram, Haryana', purpose: 'expansion' }).expect(200);
    const again = await app.post('/loan/requirement', { entityType: 'msme', loanCategory: 'business', amount: 2_500_000, tenureYears: 3, location: 'Gurugram, Haryana', purpose: 'expansion' }).expect(200);
    expect(again.body.id).toBe(requirement.body.id);
    const applicationId = requirement.body.id as string;
    const v1 = (path: string) => t.api().get(`/v1${path}`).set(bearer(session.body.token));
    expect((await v1(`/applications/${applicationId}`).expect(200)).body).toMatchObject({ segmentKey: 'msme', subSegmentKey: 'proprietorship', categoryKey: 'business', amountPaise: 25 * LAKH, tenureMonths: 36 });

    await app.post('/loan/pre-check', { entityType: 'msme', answers: { businessAge: '3-5', monthlyTurnover: '5-25L', existingEmis: 'no', gstRegistered: 'yes' } }).expect(200);
    const at = new Date().toISOString();
    await app.post('/consent', { version: '2026-10-v1', submittedAt: at, items: { aiDocuments: { granted: true, at }, creditBureau: { granted: false, at }, lenderSharing: { granted: false, at } } }).expect(200);
    expect((await v1(`/applications/${applicationId}`).expect(200)).body.status).toBe('documents_pending');

    const uploaded = await t.api().post('/v0/documents').set(bearer(session.body.token)).field('docType', 'bankStatement').field('consentVersion', '2026-10-v1').attach('file', PDF, { filename: 'statement.pdf', contentType: 'application/pdf' }).expect(201);
    expect(uploaded.body.status).toBe('processing');
    expect(await inCls(() => t.app.get(DocumentScanService).scan(uploaded.body.id))).toBe('clean');
    expect((await app.get(`/documents/${uploaded.body.id}`).expect(200)).body).toEqual({ status: 'verified' });
    await t.api().post('/v0/documents').set(bearer(session.body.token)).field('docType', 'passport').attach('file', PDF, { filename: 'passport.pdf', contentType: 'application/pdf' }).expect(400);
    const spare = await t.api().post('/v0/documents').set(bearer(session.body.token)).field('docType', 'pan').attach('file', PDF, { filename: 'pan.pdf', contentType: 'application/pdf' }).expect(201);
    await t.api().delete(`/v0/documents/${spare.body.id}`).set(bearer(session.body.token)).expect(204);

    const pan = randomPan();
    const profile = await t.api().patch('/v0/auth/profile').set(bearer(session.body.token)).send({ fullName: 'Kabir Malhotra', pan, dob: '15/08/1985' }).expect(200);
    expect(profile.body).toEqual({ fullName: 'Kabir Malhotra', pan, dob: '15/08/1985' });
    expect((await v1(`/applications/${applicationId}`).expect(200)).body.party).toMatchObject({ kind: 'business', displayName: 'Kabir Malhotra' });

    const analysis = await app.post('/analysis', { documentIds: [uploaded.body.id], consentVersion: '2026-10-v1' }).expect(202);
    expect((await app.get(`/analysis/${analysis.body.id}`).expect(200)).body.status).toBe('running');
    await app.post('/notifications/whatsapp', { analysisId: analysis.body.id, event: 'analysis.completed' }).expect(200);
    expect(await inCls(() => t.app.get(AnalysisService).run(analysis.body.id))).toBe('done');
    const finished = await app.get(`/analysis/${analysis.body.id}`).expect(200);
    expect(finished.body.status).toBe('done');
    expect(finished.body.steps.every((step: { state: string }) => step.state === 'done')).toBe(true);

    const score = await app.post('/score', { analysisId: analysis.body.id }).expect(200);
    expect(score.body.score).toMatchObject({ analysisId: analysis.body.id, basedOn: 'Based On Your Bank Statement.' });
    expect(typeof score.body.score.value).toBe('number');
    expect(score.body.score.factors.map((factor: { id: string }) => factor.id)).toContain('gst');

    const lenders = await app.post('/lenders', { analysisId: analysis.body.id }).expect(200);
    const offer = lenders.body.lenders.find((item: { name: string }) => item.name === 'Compat Finance');
    expect(offer).toMatchObject({ kind: 'NBFC', product: 'Compat Business Loan', verified: true, interest: 'From 14% a year, as per lender policy' });

    expect((await app.post('/applications', { lenderId: offer.id }).expect(403)).body.code).toBe('CONSENT_REQUIRED');
    await app.post('/consent', { version: '2026-10-v1', submittedAt: at, items: { aiDocuments: { granted: true, at }, creditBureau: { granted: false, at }, lenderSharing: { granted: true, at } } }).expect(200);
    const applied = await app.post('/applications', { lenderId: offer.id }).expect(201);
    expect(applied.body).toMatchObject({ lenderId: offer.id, lenderName: 'Compat Finance', product: 'Compat Business Loan', amount: 2_500_000, status: 'under_review' });
    expect(applied.body.id).toMatch(/^SB-/);
    expect(applied.body.timeline.map((step: { id: string; state: string }) => [step.id, step.state])).toEqual([
      ['documents', 'done'],
      ['sent', 'active'],
      ['review', 'pending'],
      ['sanctioned', 'pending'],
      ['disbursed', 'pending'],
    ]);
    await app.post('/notifications/whatsapp', { applicationId: applied.body.id, event: 'application.status' }).expect(200);
    expect(await t.prisma.notificationSubscription.count({ where: { event: 'submission.status_changed', userId: session.body.user.id } })).toBe(1);

    const submission = await t.prisma.lenderSubmission.findFirstOrThrow({ where: { ref: applied.body.id } });
    await staff(ops).post(`/ops/submissions/${submission.id}/approve`).expect(200);
    expect(await inCls(() => t.app.get(SubmissionService).deliver(submission.id))).toMatchObject({ delivered: true });
    const sent = await app.get(`/applications/${applied.body.id}`).expect(200);
    expect(sent.body.timeline.map((step: { state: string }) => step.state)).toEqual(['done', 'done', 'active', 'pending', 'pending']);
    expect(sent.body.timeline[1].at).toEqual(expect.any(String));

    await t.api().get(`/v0/applications/${applied.body.id}`).expect(401);
    await t.api().post('/v1/v0/score').expect(404);
  });
});
