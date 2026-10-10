import { Outcome } from '../conditions/condition.types.js';
import type { CompiledQuestion, QuestionSection, ResolvedQuestion, ResolvedQuestionnaire } from './questionnaire.types.js';

export type AttributeNeed = { attributeKey: string; weight: number; required: boolean; neededBy: string };

export type AddedQuestion = { questionKey: string; attributeKey: string; weight: number; neededBy: string[] };

export const PROGRESSIVE_SET_KEY = 'progressive';

export const PROGRESSIVE_SECTION: QuestionSection = { key: PROGRESSIVE_SET_KEY, label: { en: 'A Few More Questions' } };

export function addProgressiveQuestions(
  resolved: ResolvedQuestionnaire,
  needs: readonly AttributeNeed[],
  bank: ReadonlyMap<string, CompiledQuestion>,
  satisfied: (attributeKey: string) => boolean,
): { questionnaire: ResolvedQuestionnaire; added: AddedQuestion[] } {
  const asked = new Set(resolved.questions.map((question) => question.question.attributeKey));
  const grouped = new Map<string, { weight: number; required: boolean; neededBy: Set<string> }>();
  for (const need of needs) {
    const entry = grouped.get(need.attributeKey) ?? { weight: 0, required: false, neededBy: new Set<string>() };
    entry.weight += need.weight;
    entry.required ||= need.required;
    entry.neededBy.add(need.neededBy);
    grouped.set(need.attributeKey, entry);
  }
  const candidates = [...grouped.entries()]
    .filter(([attributeKey]) => !asked.has(attributeKey) && bank.has(attributeKey) && !satisfied(attributeKey))
    .toSorted(([leftKey, left], [rightKey, right]) => right.weight - left.weight || leftKey.localeCompare(rightKey));
  const added: AddedQuestion[] = [];
  const questions: ResolvedQuestion[] = [];
  for (const [attributeKey, entry] of candidates) {
    const question = bank.get(attributeKey);
    if (!question) continue;
    questions.push({ question, required: entry.required, section: PROGRESSIVE_SET_KEY, visibleIf: null, setKey: PROGRESSIVE_SET_KEY, setVersionId: '', visibility: Outcome.Pass });
    added.push({ questionKey: question.key, attributeKey, weight: entry.weight, neededBy: [...entry.neededBy].toSorted((left, right) => left.localeCompare(right)) });
  }
  if (questions.length === 0) return { questionnaire: resolved, added };
  return { questionnaire: { ...resolved, sections: [...resolved.sections, PROGRESSIVE_SECTION], questions: [...resolved.questions, ...questions] }, added };
}
