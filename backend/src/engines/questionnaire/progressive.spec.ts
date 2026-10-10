import { describe, expect, it } from 'vitest';

import { addProgressiveQuestions, type AttributeNeed } from './progressive.js';
import type { CompiledQuestion, ResolvedQuestionnaire } from './questionnaire.types.js';

const question = (key: string, attributeKey: string): CompiledQuestion => ({ key, attributeKey, kind: 'number', label: { en: key }, help: null, options: null, validation: null, ui: null });

const bank = new Map([
  ['business.vintage_months', question('vintage', 'business.vintage_months')],
  ['business.exports', question('exports', 'business.exports')],
  ['bureau.score', question('bureau', 'bureau.score')],
  ['business.gst_registered', question('gst', 'business.gst_registered')],
]);

const base: ResolvedQuestionnaire = {
  sets: [{ key: 'pre_check.msme', versionId: 'v1', number: 1 }],
  sections: [],
  questions: [{ question: question('vintage', 'business.vintage_months'), required: true, section: null, visibleIf: null, setKey: 'pre_check.msme', setVersionId: 'v1', visibility: 'pass' }],
  hidden: [],
};

const need = (attributeKey: string, neededBy: string, weight = 1, required = false): AttributeNeed => ({ attributeKey, weight, required, neededBy });

describe('progressive profiling', () => {
  it('adds questions for attributes still needed, most needed first, skipping known and already asked ones', () => {
    const result = addProgressiveQuestions(
      base,
      [need('business.exports', 'lender_a'), need('business.gst_registered', 'lender_a'), need('business.gst_registered', 'lender_b', 1, true), need('bureau.score', 'scoring'), need('business.vintage_months', 'lender_b'), need('business.unknown', 'lender_c')],
      bank,
      (attr) => attr === 'bureau.score',
    );
    expect(result.added).toEqual([
      { questionKey: 'gst', attributeKey: 'business.gst_registered', weight: 2, neededBy: ['lender_a', 'lender_b'] },
      { questionKey: 'exports', attributeKey: 'business.exports', weight: 1, neededBy: ['lender_a'] },
    ]);
    expect(result.questionnaire.questions.map((item) => [item.question.key, item.required, item.section])).toEqual([['vintage', true, null], ['gst', true, 'progressive'], ['exports', false, 'progressive']]);
    expect(result.questionnaire.sections.map((section) => section.key)).toEqual(['progressive']);
  });

  it('leaves the questionnaire untouched when nothing is needed', () => {
    expect(addProgressiveQuestions(base, [], bank, () => false).questionnaire).toBe(base);
  });
});
