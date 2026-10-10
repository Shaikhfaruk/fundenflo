import type { FactValue, RangeValue } from '../conditions/condition.types.js';
import { isRange } from '../conditions/evaluate.js';

export type Deviation = { deviates: boolean; deviationPct: number | null };

const PERCENT = 100;

const bounds = (value: number | RangeValue): [number, number] => (typeof value === 'number' ? [value, value] : [value.min ?? Number.NEGATIVE_INFINITY, value.max ?? Number.POSITIVE_INFINITY]);

const numericLike = (value: FactValue): value is number | RangeValue => typeof value === 'number' || isRange(value);

function numericDeviation(declared: number | RangeValue, observed: number | RangeValue, tolerancePct: number): Deviation {
  const [declaredMin, declaredMax] = bounds(declared);
  const [observedMin, observedMax] = bounds(observed);
  if (observedMax >= declaredMin && observedMin <= declaredMax) return { deviates: false, deviationPct: 0 };
  const [reference, distance] = observedMin > declaredMax ? [declaredMax, observedMin - declaredMax] : [declaredMin, declaredMin - observedMax];
  const deviationPct = Number.isFinite(reference) ? Math.round((distance / Math.max(Math.abs(reference), 1)) * PERCENT * 100) / 100 : null;
  return { deviates: deviationPct === null || deviationPct > tolerancePct, deviationPct };
}

const canonical = (value: FactValue) => (Array.isArray(value) ? JSON.stringify(value.toSorted((left, right) => String(left).localeCompare(String(right)))) : JSON.stringify(value));

export function compareFacts(declared: FactValue, observed: FactValue, tolerancePct: number): Deviation {
  if (declared === null || observed === null) return { deviates: false, deviationPct: null };
  if (numericLike(declared) && numericLike(observed)) return numericDeviation(declared, observed, tolerancePct);
  return { deviates: canonical(declared) !== canonical(observed), deviationPct: null };
}

export const DeviationSeverity = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const;

export type DeviationSeverity = (typeof DeviationSeverity)[keyof typeof DeviationSeverity];

export function severityOf(deviationPct: number | null, mediumFromPct: number, highFromPct: number): DeviationSeverity {
  if (deviationPct === null) return DeviationSeverity.Medium;
  if (deviationPct >= highFromPct) return DeviationSeverity.High;
  return deviationPct >= mediumFromPct ? DeviationSeverity.Medium : DeviationSeverity.Low;
}
