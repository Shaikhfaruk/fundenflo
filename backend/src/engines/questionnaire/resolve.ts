import { Outcome } from '../conditions/condition.types.js';
import type { FactLookup } from '../conditions/condition.types.js';
import { evaluateCondition } from '../conditions/evaluate.js';
import type { ActiveQuestionSet, QuestionnaireContext, QuestionScope, QuestionSection, ResolvedQuestion, ResolvedQuestionnaire } from './questionnaire.types.js';

const SCOPE_DIMENSIONS = [
  ['segments', 'segment'],
  ['subSegments', 'subSegment'],
  ['categories', 'category'],
  ['leadSources', 'leadSource'],
] as const satisfies ReadonlyArray<readonly [keyof QuestionScope, keyof QuestionnaireContext]>;

export function scopeMatches(scope: QuestionScope, context: QuestionnaireContext): boolean {
  return SCOPE_DIMENSIONS.every(([dimension, field]) => {
    const allowed = scope[dimension];
    if (!allowed || allowed.length === 0) return true;
    const value = context[field];
    return value !== undefined && allowed.includes(value);
  });
}

export const scopeSpecificity = (scope: QuestionScope): number => SCOPE_DIMENSIONS.filter(([dimension]) => (scope[dimension]?.length ?? 0) > 0).length;

export function resolveQuestionnaire(sets: readonly ActiveQuestionSet[], context: QuestionnaireContext, lookup?: FactLookup): ResolvedQuestionnaire {
  const applicable = sets
    .filter((entry) => entry.set.stage === context.stage && scopeMatches(entry.set.scope, context))
    .toSorted((left, right) => scopeSpecificity(left.set.scope) - scopeSpecificity(right.set.scope) || left.key.localeCompare(right.key));

  const merged = new Map<string, Omit<ResolvedQuestion, 'visibility'>>();
  const sections = new Map<string, QuestionSection>();
  for (const entry of applicable) {
    for (const section of entry.set.sections) sections.set(section.key, section);
    for (const item of entry.set.items) {
      const existing = merged.get(item.question.key);
      merged.set(item.question.key, {
        ...item,
        required: item.required || (existing?.required ?? false),
        setKey: entry.key,
        setVersionId: entry.versionId,
      });
    }
  }

  const questions: ResolvedQuestion[] = [];
  const hidden: string[] = [];
  for (const item of merged.values()) {
    const visibility = item.visibleIf && lookup ? evaluateCondition(item.visibleIf, lookup).outcome : Outcome.Pass;
    if (visibility === Outcome.Fail) hidden.push(item.question.key);
    else questions.push({ ...item, visibility });
  }

  return {
    sets: applicable.map((entry) => ({ key: entry.key, versionId: entry.versionId, number: entry.number })),
    sections: [...sections.values()],
    questions,
    hidden,
  };
}

export const remainingRequired = (questionnaire: ResolvedQuestionnaire, answered: ReadonlySet<string>): string[] =>
  questionnaire.questions.filter((question) => question.required && !answered.has(question.question.key)).map((question) => question.question.key);
