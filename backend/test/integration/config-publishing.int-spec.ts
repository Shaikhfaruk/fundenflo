import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '../../src/common/enums/db.enums.js';
import { bearer, createStaffSession, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const SETS = '/v1/admin/question-sets';

const lapContent = (gstRequired: boolean) => ({
  stage: 'pre_check',
  scope: { segments: ['msme'], categories: ['lap'] },
  items: [
    { questionKey: 'gst_registered', required: gstRequired },
    { questionKey: 'monthly_turnover', visibleIf: { attr: 'business.gst_registered', op: 'eq', value: true } },
  ],
});

describe('versioned config with maker-checker (question sets)', () => {
  let t: TestApp;
  let maker: StaffSession;
  let checker: StaffSession;
  let support: StaffSession;
  let documentId: string;

  const publicLap = () => t.api().get('/v1/catalog/questions').query({ stage: 'pre_check', segment: 'msme', category: 'lap' }).expect(200);

  beforeAll(async () => {
    t = await startTestApp();
    maker = await createStaffSession(t, Role.ops_lead, 'Vikram Rao');
    checker = await createStaffSession(t, Role.ops_lead, 'Sneha Pillai');
    support = await createStaffSession(t, Role.support, 'Imran Khan');
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates a document with a first draft and rejects malformed content', async () => {
    const malformed = await t.api().post(SETS).set(bearer(maker.accessToken)).send({ key: 'pre_check.msme_broken', name: { en: 'Broken' }, content: { stage: 'pre_check' } }).expect(400);
    expect(malformed.body.details.map((detail: { path: string }) => detail.path)).toContain('content.items');

    const created = await t.api().post(SETS).set(bearer(maker.accessToken)).send({ key: 'pre_check.msme_lap', name: { en: 'MSME LAP Pre-Check' }, content: lapContent(true) }).expect(201);
    documentId = created.body.id;
    expect(created.body).toMatchObject({ resource: 'question_set', key: 'pre_check.msme_lap', activeVersion: null, openVersion: { number: 1, status: 'draft' } });

    const draft = await t.api().get(`${SETS}/${documentId}/versions/1`).set(bearer(maker.accessToken)).expect(200);
    expect(draft.body).toMatchObject({ status: 'draft', issues: [], compiled: null, availableActions: ['edit', 'submit', 'retire'] });

    await t.api().post(`${SETS}/${documentId}/versions`).set(bearer(maker.accessToken)).send({}).expect(409).expect((response) => expect(response.body.code).toBe('OPEN_VERSION_EXISTS'));
  });

  it('keeps problems on the draft and refuses to submit until they are fixed', async () => {
    const broken = await t.api().post(SETS).set(bearer(maker.accessToken)).send({
      key: 'pre_check.msme_unknown',
      name: { en: 'Unknown Question' },
      content: { stage: 'pre_check', scope: { segments: ['msme', 'nonexistent'] }, items: [{ questionKey: 'export_share' }] },
    }).expect(201);
    const version = await t.api().get(`${SETS}/${broken.body.id}/versions/1`).set(bearer(maker.accessToken)).expect(200);
    expect(version.body.issues.map((issue: { code: string }) => issue.code).toSorted()).toEqual(['unknown_key', 'unknown_question']);
    const submit = await t.api().post(`${SETS}/${broken.body.id}/versions/1/submit`).set(bearer(maker.accessToken)).send({ reason: 'Trying anyway' }).expect(400);
    expect(submit.body.details.map((detail: { path: string }) => detail.path).toSorted()).toEqual(['content.items.0.questionKey', 'content.scope.segments.1']);
  });

  it('enforces four eyes: the maker cannot approve, read-only staff cannot decide, rejection reopens the draft', async () => {
    const submitted = await t.api().post(`${SETS}/${documentId}/versions/1/submit`).set(bearer(maker.accessToken)).send({ reason: 'LAP needs GST and turnover' }).expect(200);
    expect(submitted.body).toMatchObject({ status: 'in_review', changeRequest: { status: 'pending' } });
    const requestId = submitted.body.changeRequest.id;

    await t.api().patch(`${SETS}/${documentId}/versions/1`).set(bearer(maker.accessToken)).send({ notes: 'late edit' }).expect(409).expect((response) => expect(response.body.code).toBe('INVALID_TRANSITION'));
    await t.api().post(`/v1/admin/change-requests/${requestId}/approve`).set(bearer(maker.accessToken)).send({}).expect(403).expect((response) => expect(response.body.code).toBe('SELF_APPROVAL_NOT_ALLOWED'));
    await t.api().post(`/v1/admin/change-requests/${requestId}/approve`).set(bearer(support.accessToken)).send({}).expect(403).expect((response) => expect(response.body.code).toBe('FORBIDDEN'));

    const detail = await t.api().get(`/v1/admin/change-requests/${requestId}`).set(bearer(checker.accessToken)).expect(200);
    expect(detail.body).toMatchObject({ resource: 'question_set', documentKey: 'pre_check.msme_lap', versionNumber: 1, diff: { changes: [{ path: '$', kind: 'added' }], comparedWith: null } });

    await t.api().post(`/v1/admin/change-requests/${requestId}/reject`).set(bearer(checker.accessToken)).send({}).expect(400);
    const rejected = await t.api().post(`/v1/admin/change-requests/${requestId}/reject`).set(bearer(checker.accessToken)).send({ note: 'Add the turnover help text first' }).expect(200);
    expect(rejected.body).toMatchObject({ status: 'rejected', versionStatus: 'draft', decisionNote: 'Add the turnover help text first' });
    await t.api().post(`/v1/admin/change-requests/${requestId}/approve`).set(bearer(checker.accessToken)).send({}).expect(409);
  });

  it('publishes after approval and serves it publicly, then freezes the version', async () => {
    const draft = await t.api().get(`${SETS}/${documentId}/versions/1`).set(bearer(maker.accessToken)).expect(200);
    await t.api().patch(`${SETS}/${documentId}/versions/1`).set(bearer(maker.accessToken)).set('If-Match', `"${draft.body.version}"`).send({ notes: 'Turnover only shows for GST-registered businesses' }).expect(200);
    const resubmitted = await t.api().post(`${SETS}/${documentId}/versions/1/submit`).set(bearer(maker.accessToken)).send({ reason: 'Addressed review' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${resubmitted.body.changeRequest.id}/approve`).set(bearer(checker.accessToken)).send({ note: 'Looks right' }).expect(200);

    expect((await publicLap()).body.sets.some((set: { key: string }) => set.key === 'pre_check.msme_lap')).toBe(false);
    const published = await t.api().post(`${SETS}/${documentId}/versions/1/publish`).set(bearer(maker.accessToken)).send({}).expect(200);
    expect(published.body).toMatchObject({ status: 'published', approvedByUserId: checker.user.id, publishedByUserId: maker.user.id, contentHash: expect.any(String) });

    const lap = await publicLap();
    expect(lap.body.sets.map((set: { key: string }) => set.key)).toEqual(['pre_check.msme', 'pre_check.msme_lap']);
    expect(lap.body.questions.map((question: { key: string }) => question.key)).toEqual(['business_age', 'monthly_turnover', 'existing_emis', 'gst_registered']);
    expect(lap.body.questions.find((question: { key: string }) => question.key === 'monthly_turnover')).toMatchObject({ setKey: 'pre_check.msme_lap', visibleIf: { attr: 'business.gst_registered' } });
    const business = await t.api().get('/v1/catalog/questions').query({ stage: 'pre_check', segment: 'msme', category: 'business' }).expect(200);
    expect(business.body.sets.map((set: { key: string }) => set.key)).toEqual(['pre_check.msme']);

    await expect(t.prisma.$executeRaw`UPDATE config_versions SET content = '{}'::jsonb WHERE id = ${published.body.id}::uuid`).rejects.toThrow(/frozen/);
    await expect(t.prisma.$executeRaw`DELETE FROM config_versions WHERE id = ${published.body.id}::uuid`).rejects.toThrow(/append-only/);
    const outbox = await t.prisma.outboxEvent.findFirst({ where: { eventName: 'config.published', aggregateId: published.body.id } });
    expect(outbox).not.toBeNull();
  });

  it('refuses unchanged versions, schedules future versions and falls back when one is retired', async () => {
    await t.api().post(`${SETS}/${documentId}/versions`).set(bearer(maker.accessToken)).send({ fromNumber: 1 }).expect(201);
    const same = await t.api().post(`${SETS}/${documentId}/versions/2/submit`).set(bearer(maker.accessToken)).send({ reason: 'No changes' }).expect(400);
    expect(same.body.details[0].code).toBe('no_changes');

    await t.api().patch(`${SETS}/${documentId}/versions/2`).set(bearer(maker.accessToken)).send({ content: lapContent(false) }).expect(200);
    const submitted = await t.api().post(`${SETS}/${documentId}/versions/2/submit`).set(bearer(maker.accessToken)).send({ reason: 'GST becomes optional' }).expect(200);
    const request = await t.api().get(`/v1/admin/change-requests/${submitted.body.changeRequest.id}`).set(bearer(checker.accessToken)).expect(200);
    expect(request.body.diff).toMatchObject({ comparedWith: { number: 1 }, changes: [{ path: '$.items[0].required', kind: 'changed', before: true, after: false }] });
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(checker.accessToken)).send({}).expect(200);

    await t.api().post(`${SETS}/${documentId}/versions/2/publish`).set(bearer(maker.accessToken)).send({ effectiveFrom: '2020-01-01T00:00:00.000Z' }).expect(400);
    const later = new Date(Date.now() + 3_600_000).toISOString();
    await t.api().post(`${SETS}/${documentId}/versions/2/publish`).set(bearer(maker.accessToken)).send({ effectiveFrom: later }).expect(200);
    const document = await t.api().get(`${SETS}/${documentId}`).set(bearer(maker.accessToken)).expect(200);
    expect(document.body).toMatchObject({ activeVersion: { number: 1 }, openVersion: null });

    const pending = await t.api().get('/v1/admin/change-requests').query({ resource: 'question_set', status: 'approved' }).set(bearer(checker.accessToken)).expect(200);
    expect(pending.body.items.map((item: { documentKey: string }) => item.documentKey)).toContain('pre_check.msme_lap');

    await t.api().post(`${SETS}/${documentId}/versions/1/retire`).set(bearer(maker.accessToken)).send({ reason: 'Replaced by version 2' }).expect(200);
    await t.api().post(`${SETS}/${documentId}/versions/1/retire`).set(bearer(maker.accessToken)).send({ reason: 'Again' }).expect(409);
    expect((await t.api().get(`${SETS}/${documentId}`).set(bearer(maker.accessToken)).expect(200)).body.activeVersion).toBeNull();
    expect((await publicLap()).body.sets.map((set: { key: string }) => set.key)).toEqual(['pre_check.msme']);
  });

  it('lets read-only staff read but not change config', async () => {
    await t.api().get(SETS).set(bearer(support.accessToken)).expect(200);
    await t.api().get('/v1/admin/change-requests').set(bearer(support.accessToken)).expect(200);
    await t.api().post(SETS).set(bearer(support.accessToken)).send({ key: 'pre_check.support', name: { en: 'Nope' }, content: lapContent(true) }).expect(403);
    await t.api().post(`${SETS}/${documentId}/versions/2/retire`).set(bearer(support.accessToken)).send({ reason: 'Not allowed' }).expect(403);
  });
});
