import { type FactLookup, Outcome } from '../conditions/condition.types.js';
import { evaluateCondition } from '../conditions/evaluate.js';
import { scopeMatches, scopeSpecificity } from '../questionnaire/resolve.js';
import type { ActiveDocumentRequirement, Checklist, ChecklistContext, ChecklistItem } from './documents.types.js';

export function resolveChecklist(requirements: readonly ActiveDocumentRequirement[], context: ChecklistContext, lookup?: FactLookup): Checklist {
  const applicable = requirements
    .filter((entry) => entry.requirement.stage === context.stage && scopeMatches(entry.requirement.scope, context))
    .toSorted((left, right) => scopeSpecificity(left.requirement.scope) - scopeSpecificity(right.requirement.scope) || left.key.localeCompare(right.key));

  const merged = new Map<string, Omit<ChecklistItem, 'applicability'>>();
  for (const entry of applicable) {
    for (const slot of entry.requirement.items) {
      const existing = merged.get(slot.key);
      merged.set(slot.key, { ...slot, requirementKey: entry.key, versionId: entry.versionId, neededBy: [...new Set([...(existing?.neededBy ?? []), entry.key])] });
    }
  }

  const items: ChecklistItem[] = [];
  const hidden: string[] = [];
  for (const slot of merged.values()) {
    const applicability = slot.when ? (lookup ? evaluateCondition(slot.when, lookup).outcome : Outcome.Unknown) : Outcome.Pass;
    if (applicability === Outcome.Fail) hidden.push(slot.key);
    else items.push({ ...slot, applicability });
  }
  return { requirements: applicable.map((entry) => ({ key: entry.key, versionId: entry.versionId })), items: items.toSorted((left, right) => Number(right.required) - Number(left.required)), hidden };
}

export function latestAssessmentYear(now = new Date()): string {
  const start = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${start}–${String(start + 1).slice(2)}`;
}
