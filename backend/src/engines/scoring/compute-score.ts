import { type FactLookup, Outcome } from '../conditions/condition.types.js';
import { evaluateCondition, isRange, referencedAttributes } from '../conditions/evaluate.js';
import type { RankedLookup } from '../facts/resolve-fact.js';
import { type CompiledFactor, type CompiledScoringModel, type FactorResult, FactorStatus, MissingPolicy, type ScoreOutcome, ScoreStatus } from './scoring.types.js';

const PERCENT = 100;

const filtered = (lookup: RankedLookup, minRank: number | null): FactLookup => (attr) => {
  const fact = lookup(attr);
  return fact && (minRank === null || fact.rank >= minRank) ? fact.value : undefined;
};

export const factorAttributes = (factor: CompiledFactor): string[] => [...new Set([...factor.bands.flatMap((band) => referencedAttributes(band.when)), ...(factor.linear ? [factor.linear.attr] : [])])];

function linearValue(raw: unknown, increasing: boolean): number | null {
  if (typeof raw === 'number') return raw;
  if (isRange(raw)) return increasing ? raw.min : raw.max;
  return null;
}

function pointsFor(factor: CompiledFactor, lookup: FactLookup): number | null {
  if (factor.linear) {
    const { attr, from, to } = factor.linear;
    const value = linearValue(lookup(attr), to >= from);
    if (value === null) return null;
    const share = Math.min(1, Math.max(0, (value - from) / (to - from)));
    return Math.round(share * factor.max);
  }
  for (const band of factor.bands) {
    const outcome = evaluateCondition(band.when, lookup).outcome;
    if (outcome === Outcome.Pass) return Math.min(factor.max, band.points);
    if (outcome === Outcome.Unknown) return null;
  }
  return 0;
}

function scoreFactor(factor: CompiledFactor, lookup: RankedLookup, consented: (purpose: string) => boolean): FactorResult {
  const inputs = factorAttributes(factor);
  const base = { key: factor.key, label: factor.label, max: factor.max, attention: false, inputs };
  const blocked = factor.requiresConsent !== null && !consented(factor.requiresConsent);
  const points = blocked ? null : pointsFor(factor, filtered(lookup, factor.minRank));
  if (points !== null) return { ...base, score: points, status: FactorStatus.Scored };
  const status = blocked ? FactorStatus.ConsentMissing : factor.missing === MissingPolicy.ExcludeRenormalise ? FactorStatus.Excluded : FactorStatus.Missing;
  return { ...base, score: factor.missing === MissingPolicy.Zero ? 0 : null, status };
}

export function computeScore(model: CompiledScoringModel, lookup: RankedLookup, consented: (purpose: string) => boolean): ScoreOutcome {
  const scored = model.factors.map((factor) => {
    const result = scoreFactor(factor, lookup, consented);
    const attention = result.score !== null && (result.score / result.max) * PERCENT < model.attentionBelowPct;
    return { ...result, attention };
  });
  const insufficient = model.factors.some((factor, index) => factor.missing === MissingPolicy.Insufficient && scored[index]?.score === null);
  const counted = scored.filter((result) => result.score !== null);
  const possible = counted.reduce((total, result) => total + result.max, 0);
  const earned = counted.reduce((total, result) => total + (result.score ?? 0), 0);
  const value = insufficient || possible === 0 ? null : Math.round((earned / possible) * PERCENT);
  const band = value === null ? null : (model.bands.toSorted((left, right) => right.min - left.min).find((entry) => value >= entry.min)?.label ?? null);
  const inputs: ScoreOutcome['inputs'] = {};
  for (const attr of [...new Set(model.factors.flatMap(factorAttributes))].toSorted((left, right) => left.localeCompare(right))) inputs[attr] = lookup(attr) ?? null;
  return {
    status: value === null ? ScoreStatus.Insufficient : ScoreStatus.Scored,
    value,
    band,
    factors: scored,
    limitations: scored.filter((result) => result.status !== FactorStatus.Scored).map((result) => ({ factor: result.key, reason: result.status })),
    inputs,
  };
}

export const scoringAttributes = (model: CompiledScoringModel): string[] => [...new Set(model.factors.flatMap(factorAttributes))];
