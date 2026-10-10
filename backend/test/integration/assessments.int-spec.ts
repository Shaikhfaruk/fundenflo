import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { AnalysisService } from '../../src/modules/assessments/application/analysis.service.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { SubscriptionService } from '../../src/modules/subscriptions/application/subscription.service.js';
import { SubscriptionEvent } from '../../src/modules/subscriptions/domain/subscription.constants.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

const allGranted = [
  { purpose: 'ai_documents', granted: true },
  { purpose: 'credit_bureau', granted: true },
  { purpose: 'lender_sharing', granted: true },
];

const scoringModel = {
  scope: { segments: ['msme'] },
  attentionBelowPct: 60,
  bands: [
    { min: 0, label: { en: 'Needs Work Before Matching' } },
    { min: 40, label: { en: 'Fair — A Few Gaps To Close' } },
    { min: 60, label: { en: 'Good — Ready For Funding' } },
    { min: 80, label: { en: 'Strong — Ready For Funding' } },
  ],
  factors: [
    { key: 'vintage', label: { en: 'Business Vintage' }, max: 10, method: 'linear', linear: { attr: 'business.vintage_months', from: 0, to: 60 } },
    {
      key: 'turnover',
      label: { en: 'Profitability & Margins' },
      max: 20,
      method: 'bands',
      missing: 'zero',
      bands: [
        { when: { attr: 'business.monthly_turnover_paise', op: 'gte', value: 25 * LAKH }, points: 20 },
        { when: { attr: 'business.monthly_turnover_paise', op: 'gte', value: 5 * LAKH }, points: 12 },
      ],
    },
    { key: 'emis', label: { en: 'Repayment Capacity' }, max: 20, method: 'bands', missing: 'exclude_renormalise', bands: [{ when: { attr: 'borrower.has_existing_emis', op: 'eq', value: false }, points: 20 }, { when: { attr: 'borrower.has_existing_emis', op: 'eq', value: true }, points: 8 }] },
    { key: 'gst', label: { en: 'GST & ITR Consistency' }, max: 15, method: 'bands', missing: 'zero', bands: [{ when: { attr: 'business.gst_registered', op: 'eq', value: true }, points: 15 }] },
    { key: 'credit', label: { en: 'Credit History' }, max: 10, method: 'bands', missing: 'exclude_renormalise', requiresConsent: 'credit_bureau', bands: [{ when: { attr: 'bureau.score', op: 'gte', value: 750 }, points: 10 }] },
  ],
};

const improvementRule = {
  trigger: { attr: 'factor.emis.pct', op: 'lt', value: 60 },
  priority: 10,
  title: { en: 'Existing EMIs Weigh On Your Repayment Capacity' },
  found: { en: 'You have existing EMIs and a score of {{score.value}}.' },
  why: { en: 'Lenders look at how much of your income already goes to EMIs.' },
  action: { en: 'Close or consolidate a small loan before applying.' },
  evidence: { en: 'A loan closure letter or a recent bank statement.' },
  evidenceDocumentType: 'bank_statement',
};

describe('scoring models, analyses, assessments and notification subscriptions', () => {
  let t: TestApp;
  let analyst: StaffSession;
  let ops: StaffSession;
  let borrower: AuthResult;
  let applicationId: string;
  let templateVersionId: string;

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);
  const run = (id: string) => inCls(() => t.app.get(AnalysisService).run(id));

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    put: (path: string, body: Record<string, unknown>) => t.api().put(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version: number) => t.api().patch(`/v1${path}`).set(bearer(session.accessToken)).set('If-Match', `"${version}"`).send(body),
  });

  const publish = async (resource: string, content: Record<string, unknown>, key: string) => {
    const created = await as(analyst).post(`/admin/${resource}`, { key, name: { en: key }, content }).expect(201);
    const submitted = await as(analyst).post(`/admin/${resource}/${created.body.id}/versions/1/submit`, { reason: 'Credit team sign-off' }).expect(200);
    await as(ops).post(`/admin/change-requests/${submitted.body.changeRequest.id}/approve`).expect(200);
    await as(analyst).post(`/admin/${resource}/${created.body.id}/versions/1/publish`).expect(200);
    return created.body.id as string;
  };

  const msmeApplication = async (session: AuthResult, businessName: string) => {
    const created = await as(session).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName, category: 'business' }).expect(201);
    await as(session).patch(`/applications/${created.body.id}/requirement`, { purpose: 'expansion', amountPaise: 25 * LAKH, tenureMonths: 36, city: 'Gurgaon' }, created.body.version).expect(200);
    await as(session).put(`/applications/${created.body.id}/answers`, { answers: [{ questionKey: 'business_age', value: '1-3' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'yes' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    return created.body.id as string;
  };

  beforeAll(async () => {
    t = await startTestApp();
    analyst = await createStaffSession(t, Role.credit_analyst, 'Meera Nair');
    ops = await createStaffSession(t, Role.ops_lead, 'Deepak Menon');
    await as(ops).post('/admin/attributes', { key: 'bureau.score', label: { en: 'Bureau Score' }, dataType: 'integer', subject: 'person', sensitivity: 'financial', allowedProvenance: ['third_party_verified', 'ops_verified'] }).expect(201);
    borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    templateVersionId = (await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200)).body.versionId;
    applicationId = await msmeApplication(borrower, 'Nair Hardware');
  });

  afterAll(async () => {
    await t.close();
  });

  it('validates and publishes a scoring model and an improvement rule through maker-checker', async () => {
    const broken = await as(analyst).post('/admin/scoring-models', { key: 'msme.broken', name: { en: 'Broken' }, content: { ...scoringModel, factors: [{ key: 'x', label: { en: 'X' }, max: 10, method: 'linear', linear: { attr: 'business.gst_registered', from: 0, to: 1 }, requiresConsent: 'telepathy' }] } }).expect(201);
    const issues = await as(analyst).post(`/admin/scoring-models/${broken.body.id}/versions/1/submit`, { reason: 'Trying a broken model' }).expect(400);
    expect(issues.body.details.map((issue: { code: string }) => issue.code).toSorted()).toEqual(['not_numeric', 'unknown_purpose']);
    const badRule = await as(analyst).post('/admin/improvement-rules', { key: 'bad.rule', name: { en: 'Bad' }, content: { ...improvementRule, found: { en: 'Your {{nope.attr}} is low' } } }).expect(201);
    expect((await as(analyst).post(`/admin/improvement-rules/${badRule.body.id}/versions/1/submit`, { reason: 'Trying' }).expect(400)).body.details[0].code).toBe('unknown_placeholder');
    await as(ops).post('/admin/scoring-models', { key: 'msme.ops', name: { en: 'Ops' }, content: scoringModel }).expect(403);

    await publish('scoring-models', scoringModel, 'msme.health');
    await publish('improvement-rules', improvementRule, 'emis.repayment');
  });

  it('runs an analysis after AI consent, scores the case and plans improvements', async () => {
    expect((await as(borrower).post(`/applications/${applicationId}/analyses`).expect(403)).body.code).toBe('CONSENT_REQUIRED');
    await as(borrower).post(`/applications/${applicationId}/consents`, { templateVersionId, items: allGranted }).expect(200);
    const queued = await as(borrower).post(`/applications/${applicationId}/analyses`).expect(202);
    expect(queued.body).toMatchObject({ status: 'queued', steps: [{ id: 'documents', state: 'pending', label: 'Reading Your Documents' }, { id: 'consistency', state: 'pending' }, { id: 'score', state: 'pending' }] });
    expect((await as(borrower).post(`/applications/${applicationId}/analyses`).expect(202)).body.id).toBe(queued.body.id);

    expect(await run(queued.body.id)).toBe('done');
    expect(await run(queued.body.id)).toBeNull();
    const done = await as(borrower).get(`/analyses/${queued.body.id}`).expect(200);
    expect(done.body).toMatchObject({ status: 'done', steps: [{ id: 'documents', state: 'done' }, { id: 'consistency', state: 'done', detail: { openSignals: 0 } }, { id: 'score', state: 'done', detail: { status: 'scored', value: 57, model: 'msme.health' } }] });

    const assessment = await as(borrower).get(`/applications/${applicationId}/assessment`).expect(200);
    expect(assessment.body.score).toMatchObject({ analysisId: queued.body.id, status: 'scored', value: 57, band: 'Fair — A Few Gaps To Close', model: { key: 'msme.health', number: 1 } });
    expect(assessment.body.score.factors.map((factor: { id: string; score: number | null; status: string }) => [factor.id, factor.score, factor.status])).toEqual([
      ['vintage', 2, 'scored'],
      ['turnover', 12, 'scored'],
      ['emis', 8, 'scored'],
      ['gst', 15, 'scored'],
      ['credit', null, 'excluded'],
    ]);
    expect(assessment.body.improvement).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'emis.repayment', found: 'You have existing EMIs and a score of 57.', evidenceDocumentType: 'bank_statement' }), expect.objectContaining({ rule: 'improve.existing_emis' })]));
    const application = await as(borrower).get(`/applications/${applicationId}`).expect(200);
    expect(application.body).toMatchObject({ status: 'assessed', assessment: { scoreResultId: assessment.body.score.id } });
    const stranger = await otpLogin(t, randomMobile(), LoginAs.borrower);
    await as(stranger).get(`/analyses/${queued.body.id}`).expect(404);
  });

  it('reproduces a stored result exactly and recomputes after ops verify a fact', async () => {
    const assessment = await as(borrower).get(`/applications/${applicationId}/assessment`).expect(200);
    const reproduced = await as(ops).post(`/ops/assessments/${assessment.body.score.id}/recompute`, { mode: 'reproduce' }).expect(200);
    expect(reproduced.body).toMatchObject({ mode: 'reproduce', matches: true, original: { value: 57 }, recomputed: { value: 57 } });

    await as(ops).post(`/ops/cases/${applicationId}/facts/business.monthly_turnover_paise/verify`, { value: 30 * LAKH, reason: 'Checked six months of bank credits' }).expect(200);
    await as(ops).post(`/ops/cases/${applicationId}/facts/nope.attr/verify`, { value: 1, reason: 'Nothing' }).expect(400);
    const current = await as(ops).post(`/ops/assessments/${assessment.body.score.id}/recompute`, { mode: 'current' }).expect(200);
    expect(current.body).toMatchObject({ mode: 'current', previous: { value: 57 }, assessment: { score: { value: 69, band: 'Good — Ready For Funding' } } });
    expect((await as(borrower).get(`/applications/${applicationId}/assessment`).expect(200)).body.score.value).toBe(69);
    expect((await as(borrower).post(`/ops/assessments/${assessment.body.score.id}/recompute`, { mode: 'reproduce' }).expect(403)).body.code).toBe('CONTEXT_NOT_ALLOWED');
  });

  it('scores an individual with the default model and tells subscribers when an analysis is ready', async () => {
    const person = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const personal = await as(person).post('/applications', { segment: 'individual', subSegment: 'salaried', category: 'personal' }).expect(201);
    await as(person).post(`/applications/${personal.body.id}/consents`, { templateVersionId, items: allGranted }).expect(200);
    const analysis = await as(person).post(`/applications/${personal.body.id}/analyses`).expect(202);
    expect((await as(person).post('/notifications/subscriptions', { event: 'analysis.completed', entityId: analysis.body.id, channel: 'whatsapp' }).expect(400)).body.details[0].code).toBe('channel_unavailable');
    await as(borrower).post('/notifications/subscriptions', { event: 'analysis.completed', entityId: analysis.body.id, channel: 'sms' }).expect(404);
    const subscription = await as(person).post('/notifications/subscriptions', { event: 'analysis.completed', entityId: analysis.body.id, channel: 'sms' }).expect(201);
    expect(subscription.body).toMatchObject({ status: 'pending', channel: 'sms', entityType: 'analysis' });

    await run(analysis.body.id);
    expect((await as(person).get(`/analyses/${analysis.body.id}`).expect(200)).body.steps[2]).toMatchObject({ id: 'score' });
    expect((await as(person).get(`/applications/${personal.body.id}/assessment`).expect(200)).body.score).toMatchObject({ status: 'insufficient', model: { key: 'score.individual' } });

    const before = await t.prisma.notificationDelivery.count({ where: { templateKey: 'analysis.completed' } });
    const sent = await inCls(() => t.app.get(SubscriptionService).deliver(SubscriptionEvent.AnalysisCompleted, { analysisId: analysis.body.id, applicationId: personal.body.id, status: 'done' }));
    expect(sent).toBe(1);
    expect(await t.prisma.notificationDelivery.count({ where: { templateKey: 'analysis.completed' } })).toBe(before + 1);
    expect((await t.prisma.notificationSubscription.findUniqueOrThrow({ where: { id: subscription.body.id } })).status).toBe('sent');
    expect(await inCls(() => t.app.get(SubscriptionService).deliver(SubscriptionEvent.AnalysisCompleted, { analysisId: analysis.body.id, applicationId: personal.body.id, status: 'done' }))).toBe(0);
  });
});
