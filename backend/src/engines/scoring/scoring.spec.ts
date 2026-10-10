import { describe, expect, it } from 'vitest';

import { buildImprovementPlan, scoreLookup } from '../improvement/build-plan.js';
import type { CompiledImprovementRule } from '../improvement/improvement.types.js';
import type { RankedLookup } from '../facts/resolve-fact.js';
import { computeScore, scoringAttributes } from './compute-score.js';
import type { CompiledScoringModel } from './scoring.types.js';

const DECLARED = 1;
const EXTRACTED = 3;

const model: CompiledScoringModel = {
  scope: { segments: ['msme'], subSegments: [] },
  attentionBelowPct: 60,
  bands: [
    { min: 0, label: { en: 'Needs Work Before Matching' } },
    { min: 60, label: { en: 'Good — Ready For Funding' } },
    { min: 80, label: { en: 'Strong — Ready For Funding' } },
  ],
  factors: [
    { key: 'vintage', label: { en: 'Business Vintage' }, max: 10, method: 'linear', bands: [], linear: { attr: 'business.vintage_months', from: 0, to: 60 }, missing: 'insufficient', requiresConsent: null, minRank: null },
    {
      key: 'cashflow',
      label: { en: 'Cash Flow & Bank Behaviour' },
      max: 25,
      method: 'bands',
      bands: [
        { when: { attr: 'bank.bounce_count_6m', op: 'eq', value: 0 }, points: 25 },
        { when: { attr: 'bank.bounce_count_6m', op: 'lte', value: 2 }, points: 12 },
      ],
      linear: null,
      missing: 'zero',
      requiresConsent: null,
      minRank: EXTRACTED,
    },
    { key: 'credit', label: { en: 'Credit History' }, max: 10, method: 'bands', bands: [{ when: { attr: 'bureau.score', op: 'gte', value: 750 }, points: 10 }], linear: null, missing: 'exclude_renormalise', requiresConsent: 'credit_bureau', minRank: null },
  ],
};

const facts = (entries: Record<string, [unknown, number]>): RankedLookup => (attr) => {
  const entry = entries[attr];
  return entry ? { value: entry[0] as number, rank: entry[1] } : undefined;
};

describe('scoring engine', () => {
  it('scores bands and linear factors, renormalises excluded ones and picks the band', () => {
    const outcome = computeScore(model, facts({ 'business.vintage_months': [30, DECLARED], 'bank.bounce_count_6m': [1, EXTRACTED] }), () => false);
    expect(outcome.factors.map((factor) => [factor.key, factor.score, factor.status, factor.attention])).toEqual([
      ['vintage', 5, 'scored', true],
      ['cashflow', 12, 'scored', true],
      ['credit', null, 'consent_missing', false],
    ]);
    expect(outcome).toMatchObject({ status: 'scored', value: 49, band: { en: 'Needs Work Before Matching' }, limitations: [{ factor: 'credit', reason: 'consent_missing' }] });
    expect(outcome.inputs).toEqual({ 'bank.bounce_count_6m': { value: 1, rank: EXTRACTED }, 'bureau.score': null, 'business.vintage_months': { value: 30, rank: DECLARED } });
  });

  it('counts consented factors, treats low-trust facts as missing and reports insufficient information', () => {
    const strong = computeScore(model, facts({ 'business.vintage_months': [{ min: 60, max: null }, DECLARED], 'bank.bounce_count_6m': [0, EXTRACTED], 'bureau.score': [780, 4] }), () => true);
    expect(strong).toMatchObject({ status: 'scored', value: 100, band: { en: 'Strong — Ready For Funding' } });
    const declaredOnly = computeScore(model, facts({ 'business.vintage_months': [60, DECLARED], 'bank.bounce_count_6m': [0, DECLARED] }), () => false);
    expect(declaredOnly.factors[1]).toMatchObject({ score: 0, status: 'missing' });
    expect(declaredOnly.value).toBe(29);
    const unknownVintage = computeScore(model, facts({ 'bank.bounce_count_6m': [0, EXTRACTED] }), () => true);
    expect(unknownVintage).toMatchObject({ status: 'insufficient', value: null, band: null });
    expect(scoringAttributes(model)).toEqual(['business.vintage_months', 'bank.bounce_count_6m', 'bureau.score']);
  });
});

const rule = (trigger: CompiledImprovementRule['trigger'], priority: number, segments: string[] = []): CompiledImprovementRule => ({
  scope: { segments },
  trigger,
  priority,
  texts: { title: { en: 't' }, found: { en: 'f' }, why: { en: 'w' }, action: { en: 'a' }, evidence: { en: 'e' } },
  evidenceDocumentType: null,
});

describe('improvement plan', () => {
  it('fires rules over factor results and facts, in priority order, only for the segment', () => {
    const outcome = computeScore(model, facts({ 'business.vintage_months': [30, DECLARED], 'bank.bounce_count_6m': [1, EXTRACTED] }), () => false);
    const lookup = scoreLookup(outcome, (attr) => (attr === 'borrower.has_existing_emis' ? true : undefined));
    const fired = buildImprovementPlan(
      [
        { key: 'bounces', rule: rule({ attr: 'factor.cashflow.pct', op: 'lt', value: 60 }, 2), meta: 1 },
        { key: 'emis', rule: rule({ all: [{ attr: 'borrower.has_existing_emis', op: 'eq', value: true }, { attr: 'score.value', op: 'lt', value: 60 }] }, 1), meta: 2 },
        { key: 'vintage', rule: rule({ attr: 'factor.vintage.attention', op: 'eq', value: true }, 3, ['individual']), meta: 3 },
        { key: 'credit', rule: rule({ attr: 'factor.credit.score', op: 'lt', value: 5 }, 0), meta: 4 },
      ],
      'msme',
      lookup,
    );
    expect(fired.map((entry) => entry.key)).toEqual(['emis', 'bounces']);
  });
});
