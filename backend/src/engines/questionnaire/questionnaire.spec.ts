import { describe, expect, it } from 'vitest';

import { answerToFact } from './answer.js';
import { questionJsonSchema } from './json-schema.js';
import type { ActiveQuestionSet, CompiledItem, CompiledQuestion } from './questionnaire.types.js';
import { remainingRequired, resolveQuestionnaire, scopeMatches, scopeSpecificity } from './resolve.js';

const label = (en: string) => ({ en });

const vintage: CompiledQuestion = {
  key: 'business_age',
  attributeKey: 'business.vintage_months',
  kind: 'single_select',
  label: label('How Old Is The Business?'),
  help: null,
  options: [
    { value: 'lt1', label: label('< 1 Yr'), fact: { min: 0, max: 11 } },
    { value: '5+', label: label('5+ Yrs'), fact: { min: 60, max: null } },
  ],
  validation: null,
  ui: { widget: 'chips', columns: 2 },
};
const gst: CompiledQuestion = { ...vintage, key: 'gst_registered', attributeKey: 'business.gst_registered', kind: 'boolean', options: null, ui: null, label: label('GST Registered?') };
const turnover: CompiledQuestion = { ...gst, key: 'monthly_turnover', attributeKey: 'business.monthly_turnover_paise', kind: 'money', validation: { min: 0, max: 100_000_000_000 } };

const item = (question: CompiledQuestion, overrides: Partial<CompiledItem> = {}): CompiledItem => ({ question, required: true, section: null, visibleIf: null, ...overrides });

const base: ActiveQuestionSet = { key: 'pre_check.msme', versionId: 'v-base', number: 1, set: { stage: 'pre_check', scope: { segments: ['msme'] }, sections: [], items: [item(vintage), item(gst, { required: false })] } };
const lap: ActiveQuestionSet = {
  key: 'pre_check.msme_lap',
  versionId: 'v-lap',
  number: 3,
  set: { stage: 'pre_check', scope: { segments: ['msme'], categories: ['lap'] }, sections: [], items: [item(gst, { required: true }), item(turnover, { visibleIf: { attr: 'business.gst_registered', op: 'eq', value: true } })] },
};

describe('scope matching', () => {
  it('treats empty dimensions as any and requires a listed value otherwise', () => {
    expect(scopeMatches({}, { stage: 'pre_check' })).toBe(true);
    expect(scopeMatches({ segments: ['msme'] }, { stage: 'pre_check', segment: 'msme' })).toBe(true);
    expect(scopeMatches({ segments: ['msme'] }, { stage: 'pre_check' })).toBe(false);
    expect(scopeMatches({ segments: ['msme'], categories: ['lap'] }, { stage: 'pre_check', segment: 'msme', category: 'business' })).toBe(false);
    expect(scopeSpecificity({ segments: ['msme'], categories: ['lap'], leadSources: [] })).toBe(2);
  });
});

describe('resolveQuestionnaire', () => {
  it('merges generic then specific sets, keeping first position and the strictest required flag', () => {
    const resolved = resolveQuestionnaire([lap, base], { stage: 'pre_check', segment: 'msme', category: 'lap' });
    expect(resolved.sets.map((set) => set.key)).toEqual(['pre_check.msme', 'pre_check.msme_lap']);
    expect(resolved.questions.map((question) => question.question.key)).toEqual(['business_age', 'gst_registered', 'monthly_turnover']);
    expect(resolved.questions[1]).toMatchObject({ required: true, setVersionId: 'v-lap' });
  });

  it('ignores sets for other stages or scopes', () => {
    const resolved = resolveQuestionnaire([lap, base], { stage: 'pre_check', segment: 'msme', category: 'business' });
    expect(resolved.questions.map((question) => question.question.key)).toEqual(['business_age', 'gst_registered']);
    expect(resolveQuestionnaire([base], { stage: 'profile', segment: 'msme' }).questions).toEqual([]);
  });

  it('hides questions whose condition fails and keeps unknown ones visible', () => {
    const context = { stage: 'pre_check', segment: 'msme', category: 'lap' };
    const hidden = resolveQuestionnaire([base, lap], context, (attr) => (attr === 'business.gst_registered' ? false : undefined));
    expect(hidden.hidden).toEqual(['monthly_turnover']);
    const unknown = resolveQuestionnaire([base, lap], context, () => undefined);
    expect(unknown.questions.at(-1)).toMatchObject({ visibility: 'unknown' });
    expect(remainingRequired(unknown, new Set(['business_age']))).toEqual(['gst_registered', 'monthly_turnover']);
  });
});

describe('answerToFact', () => {
  it('maps a chosen option to its fact value', () => {
    expect(answerToFact(vintage, '5+')).toEqual({ ok: true, value: { min: 60, max: null } });
    expect(answerToFact(vintage, '3-5')).toEqual({ ok: false, message: 'must be one of the listed options' });
  });

  it('validates multi-select, money, dates, text and pincodes', () => {
    const products: CompiledQuestion = { ...vintage, kind: 'multi_select', options: [{ value: 'a', label: label('A'), fact: 'a' }, { value: 'b', label: label('B'), fact: 'b' }], validation: { maxSelections: 1 } };
    expect(answerToFact(products, ['a', 'a'])).toEqual({ ok: true, value: ['a'] });
    expect(answerToFact(products, ['a', 'b']).ok).toBe(false);
    expect(answerToFact(turnover, 12.5)).toEqual({ ok: false, message: 'must be a whole number' });
    expect(answerToFact(turnover, -1)).toEqual({ ok: false, message: 'must be at least 0' });
    expect(answerToFact({ ...gst, kind: 'date' }, '2026-02-30').ok).toBe(false);
    expect(answerToFact({ ...gst, kind: 'date' }, '2026-02-28')).toEqual({ ok: true, value: '2026-02-28' });
    expect(answerToFact({ ...gst, kind: 'text', validation: { pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$' } }, ' ABCDE1234F ')).toEqual({ ok: true, value: 'ABCDE1234F' });
    expect(answerToFact({ ...gst, kind: 'pincode' }, '012345').ok).toBe(false);
    expect(answerToFact(gst, null)).toEqual({ ok: false, message: 'an answer is required' });
  });
});

describe('questionJsonSchema', () => {
  it('describes each question type for generic client rendering', () => {
    expect(questionJsonSchema(vintage)).toEqual({ type: 'string', enum: ['lt1', '5+'] });
    expect(questionJsonSchema(turnover)).toEqual({ type: 'integer', minimum: 0, maximum: 100_000_000_000 });
    expect(questionJsonSchema({ ...gst, kind: 'pincode' })).toEqual({ type: 'string', pattern: '^[1-9]\\d{5}$' });
  });
});
