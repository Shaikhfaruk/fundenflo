import type { CompiledScoringModel } from './scoring.types.js';

export type ModelCandidate<T> = { key: string; model: CompiledScoringModel; meta: T };

export function selectScoringModel<T>(candidates: ReadonlyArray<ModelCandidate<T>>, segment: string, subSegment: string | null): ModelCandidate<T> | null {
  const matching = candidates.filter(({ model }) => model.scope.segments.includes(segment) && (model.scope.subSegments.length === 0 || (subSegment !== null && model.scope.subSegments.includes(subSegment))));
  return matching.toSorted((left, right) => Number(right.model.scope.subSegments.length > 0) - Number(left.model.scope.subSegments.length > 0) || left.key.localeCompare(right.key))[0] ?? null;
}
