import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PartyKind, Role } from '../../src/common/enums/db.enums.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

describe('questions, answers and facts', () => {
  let t: TestApp;
  let ops: StaffSession;
  let partyId: string;

  const answer = (answers: Array<{ questionKey: string; value: unknown }>, context: Record<string, string> = { stage: 'pre_check', segment: 'msme' }) =>
    t.api().post(`/v1/ops/parties/${partyId}/answers`).set(bearer(ops.accessToken)).send({ ...context, answers });

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Farhan Ali');
    partyId = (await t.prisma.party.create({ data: { kind: PartyKind.business, displayName: 'Sai Krupa Textiles' } })).id;
  });

  afterAll(async () => {
    await t.close();
  });

  it('serves the seeded pre-check with option values the v0.1 app already uses', async () => {
    const individual = await t.api().get('/v1/catalog/questions').query({ stage: 'pre_check', segment: 'individual' }).set('Accept-Language', 'hi').expect(200);
    expect(individual.body.questions.map((question: { key: string }) => question.key)).toEqual(['employment', 'monthly_income', 'work_experience', 'existing_emis']);
    expect(individual.body.questions[0]).toMatchObject({
      type: 'single_select',
      label: 'How Do You Earn?',
      required: true,
      options: [{ value: 'salaried', label: 'Salaried' }, { value: 'self-employed', label: 'Self-employed' }],
      schema: { type: 'string', enum: ['salaried', 'self-employed'] },
      ui: { widget: 'chips', columns: 2 },
    });
    await t.api().get('/v1/catalog/questions').query({ stage: 'unknown' }).expect(400);
    expect((await t.api().get('/v1/catalog/questions').query({ stage: 'profile', segment: 'msme' }).expect(200)).body.questions).toEqual([]);
  });

  it('validates questions against the attribute they fill', async () => {
    const mismatch = await t.api().post('/v1/admin/questions').set(bearer(ops.accessToken)).send({ key: 'gst_amount', attributeKey: 'business.gst_registered', type: 'money', label: { en: 'GST' } }).expect(400);
    expect(mismatch.body.details[0].code).toBe('type_mismatch');

    const badFact = await t.api().post('/v1/admin/questions').set(bearer(ops.accessToken)).send({
      key: 'constitution', attributeKey: 'business.constitution', type: 'single_select', label: { en: 'Type Of Business' },
      options: [{ value: 'pvt', label: { en: 'Pvt Ltd' }, fact: 'private_limited' }, { value: 'xyz', label: { en: 'XYZ' }, fact: 'xyz' }],
    }).expect(400);
    expect(badFact.body.details).toEqual([expect.objectContaining({ path: 'options.1.fact', code: 'invalid_fact' })]);

    const created = await t.api().post('/v1/admin/questions').set(bearer(ops.accessToken)).send({
      key: 'constitution', attributeKey: 'business.constitution', type: 'single_select', label: { en: 'Type Of Business' },
      options: [{ value: 'pvt', label: { en: 'Pvt Ltd' }, fact: 'private_limited' }, { value: 'prop', label: { en: 'Proprietor' }, fact: 'proprietorship' }],
    }).expect(201);
    expect(created.body).toMatchObject({ key: 'constitution', status: 'active', version: 1 });

    const textWithOptions = await t.api().patch(`/v1/admin/questions/${created.body.id}`).set(bearer(ops.accessToken)).send({ validation: { pattern: '^[A-Z]+$' } }).expect(400);
    expect(textWithOptions.body.details[0]).toMatchObject({ path: 'validation.pattern', code: 'not_allowed' });
    await t.api().patch(`/v1/admin/questions/${created.body.id}`).set(bearer(ops.accessToken)).set('If-Match', '"1"').send({ help: { en: 'As per your registration' } }).expect(200);

    const list = await t.api().get('/v1/admin/questions').query({ attributeKey: 'business.vintage_months' }).set(bearer(ops.accessToken)).expect(200);
    expect(list.body.items.map((question: { key: string }) => question.key)).toEqual(['business_age']);
  });

  it('turns answers into declared facts linked one to one, and reports what is still required', async () => {
    const invalid = await answer([
      { questionKey: 'business_age', value: '7+' },
      { questionKey: 'employment', value: 'salaried' },
      { questionKey: 'gst_registered', value: 'yes' },
      { questionKey: 'gst_registered', value: 'no' },
    ]).expect(400);
    expect(invalid.body.details.map((detail: { path: string; code: string }) => `${detail.path}:${detail.code}`)).toEqual([
      'answers.0.value:invalid_answer',
      'answers.1.questionKey:unknown_question',
      'answers.3.questionKey:duplicate',
    ]);

    const saved = await answer([
      { questionKey: 'business_age', value: '1-3' },
      { questionKey: 'monthly_turnover', value: '5-25L' },
      { questionKey: 'gst_registered', value: 'yes' },
    ]).expect(201);
    expect(saved.body.remaining).toEqual(['existing_emis']);
    expect(saved.body.answers).toHaveLength(3);
    const ageAnswer = saved.body.answers.find((item: { questionKey: string }) => item.questionKey === 'business_age');
    const ageFact = saved.body.facts.find((fact: { attributeKey: string }) => fact.attributeKey === 'business.vintage_months');
    expect(ageFact).toMatchObject({ value: { min: 12, max: 35 }, provenance: 'declared', sourceType: 'question_answer', sourceId: ageAnswer.id });
    expect(ageAnswer).toMatchObject({ value: '1-3', factId: ageFact.factId, channel: 'ops', answeredByUserId: ops.user.id });

    const evaluation = await t.api().post('/v1/admin/conditions/evaluate').set(bearer(ops.accessToken)).send({
      condition: { all: [{ attr: 'business.monthly_turnover_paise', op: 'gte', value: 50_000_000 }, { attr: 'business.vintage_months', op: 'gte', value: 12 }] },
      partyId,
    }).expect(200);
    expect(evaluation.body.outcome).toBe('pass');

    const finished = await answer([{ questionKey: 'existing_emis', value: 'no' }]).expect(201);
    expect(finished.body.remaining).toEqual([]);

    const history = await t.api().get(`/v1/ops/parties/${partyId}/answers`).query({ limit: 2 }).set(bearer(ops.accessToken)).expect(200);
    expect(history.body.items).toHaveLength(2);
    expect(history.body.nextCursor).toBeTruthy();
    await t.api().get('/v1/ops/parties/01900000-0000-7000-8000-000000000000/answers').set(bearer(ops.accessToken)).expect(404);
    await expect(t.prisma.$executeRaw`UPDATE answers SET value = '"5+"'::jsonb WHERE id = ${ageAnswer.id}::uuid`).rejects.toThrow(/append-only/);
  });

  it('previews a draft with an overlay before anything is published', async () => {
    const draft = await t.api().post('/v1/admin/question-sets').set(bearer(ops.accessToken)).send({
      key: 'lead_capture.msme_campaign',
      name: { en: 'MSME Campaign Form' },
      content: {
        stage: 'lead_capture',
        sections: [{ key: 'business', label: { en: 'About The Business' } }],
        items: [
          { questionKey: 'constitution', section: 'business' },
          { questionKey: 'monthly_turnover', section: 'business', visibleIf: { attr: 'business.constitution', op: 'in', value: ['private_limited'] } },
        ],
      },
    }).expect(201);
    const preview = (facts: Record<string, unknown>) => t.api().post(`/v1/admin/question-sets/${draft.body.id}/versions/1/preview`).set(bearer(ops.accessToken)).send({ facts }).expect(200);

    const hidden = await preview({ 'business.constitution': 'proprietorship' });
    expect(hidden.body).toMatchObject({ valid: true, questionnaire: { sections: [{ key: 'business', label: 'About The Business' }], hidden: ['monthly_turnover'] } });
    const shown = await preview({ 'business.constitution': 'private_limited' });
    expect(shown.body.questionnaire.questions.map((question: { key: string }) => question.key)).toEqual(['constitution', 'monthly_turnover']);
    expect((await t.api().get('/v1/catalog/questions').query({ stage: 'lead_capture' }).expect(200)).body.questions).toEqual([]);
  });

  it('keeps borrowers and read-only staff away from writes', async () => {
    const support = await createStaffSession(t, Role.support, 'Pooja Desai');
    await t.api().get('/v1/admin/questions').set(bearer(support.accessToken)).expect(200);
    await t.api().post('/v1/admin/questions').set(bearer(support.accessToken)).send({ key: 'nope', attributeKey: 'business.gst_registered', type: 'boolean', label: { en: 'Nope' } }).expect(403);
    await t.api().post(`/v1/ops/parties/${partyId}/answers`).set(bearer(support.accessToken)).send({ stage: 'pre_check', segment: 'msme', answers: [{ questionKey: 'gst_registered', value: 'no' }] }).expect(403);
    const borrower = await otpLogin(t, randomMobile());
    await t.api().get(`/v1/ops/parties/${partyId}/answers`).set(bearer(borrower.accessToken)).expect(403);
  });
});
