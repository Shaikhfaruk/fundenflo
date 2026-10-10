import { type FactLookup, Outcome } from '../conditions/condition.types.js';
import { evaluateCondition, referencedAttributes } from '../conditions/evaluate.js';
import type { RankedLookup } from '../facts/resolve-fact.js';
import { type CompiledLenderProduct, Eligibility, type EligibilityResult, type PartyLookups, type ProductRule, RuleParty, type RuleResult } from './lending.types.js';

const plain = (lookup: RankedLookup, minRank: number | null): FactLookup => (attr) => {
  const fact = lookup(attr);
  if (!fact) return undefined;
  return minRank !== null && fact.rank < minRank ? undefined : fact.value;
};

const anyOf = (outcomes: Outcome[]) => (outcomes.includes(Outcome.Pass) ? Outcome.Pass : outcomes.includes(Outcome.Unknown) || outcomes.length === 0 ? Outcome.Unknown : Outcome.Fail);

const allOf = (outcomes: Outcome[]) => (outcomes.includes(Outcome.Fail) ? Outcome.Fail : outcomes.includes(Outcome.Unknown) || outcomes.length === 0 ? Outcome.Unknown : Outcome.Pass);

function evaluateRule(rule: ProductRule, lookups: PartyLookups): RuleResult {
  const targets = rule.party === RuleParty.Primary ? [lookups.primary] : rule.party === RuleParty.AnyCoApplicant ? lookups.coApplicants : lookups.directors;
  const traces = targets.map((lookup) => evaluateCondition(rule.when, plain(lookup, rule.minRank)));
  const outcomes = traces.map((trace) => trace.outcome);
  const outcome = rule.party === RuleParty.AnyCoApplicant ? anyOf(outcomes) : allOf(outcomes);
  const message = outcome === Outcome.Pass ? rule.pass : outcome === Outcome.Fail ? rule.fail : null;
  return { id: rule.id, outcome, party: rule.party, message, traces };
}

export function productAttributes(product: CompiledLenderProduct): string[] {
  return [...new Set([...product.hard, ...product.soft].flatMap((rule) => referencedAttributes(rule.when)))];
}

export function evaluateProduct(product: CompiledLenderProduct, lookups: PartyLookups): EligibilityResult {
  const hard = product.hard.map((rule) => evaluateRule(rule, lookups));
  const soft = product.soft.map((rule) => ({ result: evaluateRule(rule, lookups), weight: rule.weight }));
  const eligibility = hard.some((result) => result.outcome === Outcome.Fail) ? Eligibility.Ineligible : hard.some((result) => result.outcome === Outcome.Unknown) ? Eligibility.NeedsInfo : Eligibility.Eligible;
  const missingAttributes = [
    ...new Set(
      product.hard
        .filter((_rule, index) => hard[index]?.outcome === Outcome.Unknown)
        .flatMap((rule) => referencedAttributes(rule.when).filter((attr) => {
          const fact = lookups.primary(attr);
          return !fact || (rule.minRank !== null && fact.rank < rule.minRank);
        })),
    ),
  ];
  return {
    eligibility,
    hard,
    soft: soft.map((entry) => entry.result),
    softScore: soft.reduce((total, entry) => total + (entry.result.outcome === Outcome.Pass ? entry.weight : 0), 0),
    softMax: soft.reduce((total, entry) => total + entry.weight, 0),
    missingAttributes,
  };
}
