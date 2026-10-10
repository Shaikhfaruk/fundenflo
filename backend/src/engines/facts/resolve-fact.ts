import { DAY_MS } from '../../common/constants/time.constants.js';
import type { FactValue } from '../conditions/condition.types.js';

export type RankedFact = { value: FactValue; rank: number };

export type RankedLookup = (attr: string) => RankedFact | undefined;

export type FactCandidate = {
  rank: number;
  observedAt: Date;
  validUntil: Date | null;
};

export type ResolvedCandidate<T extends FactCandidate> = { fact: T; stale: boolean };

export const isStale = (observedAt: Date, freshnessDays: number | null | undefined, now: Date): boolean =>
  Boolean(freshnessDays && observedAt.getTime() + freshnessDays * DAY_MS < now.getTime());

export const isExpired = (validUntil: Date | null, now: Date): boolean => validUntil !== null && validUntil < now;

export function isBetterFact(candidate: ResolvedCandidate<FactCandidate>, existing: ResolvedCandidate<FactCandidate>): boolean {
  if (candidate.stale !== existing.stale) return !candidate.stale;
  if (candidate.fact.rank !== existing.fact.rank) return candidate.fact.rank > existing.fact.rank;
  return candidate.fact.observedAt > existing.fact.observedAt;
}

export function resolveFact<T extends FactCandidate>(candidates: readonly T[], freshnessDays: number | null | undefined, now: Date): ResolvedCandidate<T> | undefined {
  let best: ResolvedCandidate<T> | undefined;
  for (const fact of candidates) {
    if (isExpired(fact.validUntil, now)) continue;
    const resolved = { fact, stale: isStale(fact.observedAt, freshnessDays, now) };
    if (!best || isBetterFact(resolved, best)) best = resolved;
  }
  return best;
}
