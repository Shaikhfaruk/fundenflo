import { type FactLookup, type FactValue, Outcome } from '../conditions/condition.types.js';
import { evaluateCondition } from '../conditions/evaluate.js';
import type { ScoreOutcome } from '../scoring/scoring.types.js';
import { type CompiledImprovementRule, ScoreAttribute } from './improvement.types.js';

const PERCENT = 100;

export function scoreLookup(outcome: ScoreOutcome, facts: FactLookup): FactLookup {
  const derived = new Map<string, FactValue>();
  if (outcome.value !== null) derived.set(ScoreAttribute.Value, outcome.value);
  for (const factor of outcome.factors) {
    if (factor.score === null) continue;
    derived.set(ScoreAttribute.factorScore(factor.key), factor.score);
    derived.set(ScoreAttribute.factorPct(factor.key), Math.round((factor.score / factor.max) * PERCENT));
    derived.set(ScoreAttribute.factorAttention(factor.key), factor.attention);
  }
  return (attr) => (derived.has(attr) ? derived.get(attr) : facts(attr));
}

export type RuleCandidate<T> = { key: string; rule: CompiledImprovementRule; meta: T };

export function buildImprovementPlan<T>(rules: ReadonlyArray<RuleCandidate<T>>, segment: string, lookup: FactLookup): Array<RuleCandidate<T>> {
  return rules
    .filter(({ rule }) => rule.scope.segments.length === 0 || rule.scope.segments.includes(segment))
    .filter(({ rule }) => evaluateCondition(rule.trigger, lookup).outcome === Outcome.Pass)
    .toSorted((left, right) => left.rule.priority - right.rule.priority || left.key.localeCompare(right.key));
}

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g;

const PAISE_PER_RUPEE = 100;

const formatNumber = (attr: string, value: number) => (attr.endsWith('_paise') ? `₹${(value / PAISE_PER_RUPEE).toLocaleString('en-IN')}` : value.toLocaleString('en-IN'));

function formatValue(attr: string, value: FactValue | undefined): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'number') return formatNumber(attr, value);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return [value.min, value.max].map((bound) => (bound === null ? '…' : formatNumber(attr, bound))).join('–');
  return value;
}

export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].flatMap((match) => (match[1] ? [match[1]] : []));
}

export function renderImprovementText(text: Record<string, string>, lookup: FactLookup): Record<string, string> {
  return Object.fromEntries(Object.entries(text).map(([locale, template]) => [locale, template.replace(PLACEHOLDER, (_match, attr: string) => formatValue(attr, lookup(attr)))]));
}
