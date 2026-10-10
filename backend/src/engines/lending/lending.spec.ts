import { describe, expect, it } from 'vitest';

import { coverageOutcome } from './coverage.js';
import { evaluateProduct, productAttributes } from './evaluate-product.js';
import type { RankedLookup } from '../facts/resolve-fact.js';
import { type CompiledLenderProduct, RuleParty } from './lending.types.js';
import { screenProduct } from './screen-product.js';

const DECLARED = 1;
const EXTRACTED = 3;
const VERIFIED = 4;

const product: CompiledLenderProduct = {
  lenderId: 'lender-1',
  lenderKey: 'lenderx',
  productKey: 'wc',
  category: 'business',
  segments: ['msme'],
  subSegments: ['proprietorship', 'partnership'],
  amountPaise: { min: 50_000_000, max: 500_000_000 },
  tenureMonths: { min: 12, max: 36 },
  coverage: { nationwide: false, stateIds: ['06', '07'], cityIds: [], includePincodes: ['560001'], excludePincodes: ['122001'] },
  hard: [
    { id: 'vintage', when: { attr: 'business.vintage_months', op: 'gte', value: 24 }, minRank: DECLARED, party: RuleParty.Primary, pass: { en: 'Business vintage fits' }, fail: { en: 'They need 2 years of history' } },
    { id: 'turnover', when: { attr: 'business.annual_turnover_paise', op: 'gte', value: 3_000_000_000 }, minRank: EXTRACTED, party: RuleParty.Primary, pass: null, fail: null },
    { id: 'directors', when: { attr: 'bureau.score', op: 'gte', value: 680 }, minRank: VERIFIED, party: RuleParty.AllDirectors, pass: null, fail: null },
  ],
  soft: [{ id: 'foir', when: { attr: 'derived.foir', op: 'lte', value: 0.5 }, minRank: null, party: RuleParty.Primary, pass: null, fail: null, weight: 3 }],
  documents: [],
  questionSet: null,
  pricingDisclosure: null,
};

const facts = (entries: Record<string, [unknown, number]>): RankedLookup => (attr) => {
  const entry = entries[attr];
  return entry ? { value: entry[0] as number, rank: entry[1] } : undefined;
};

describe('product coverage and screening', () => {
  it('applies excludes before includes, then the nationwide flag, cities and states', () => {
    expect(coverageOutcome(product.coverage, { stateId: '06', cityId: null, pincode: '122001' })).toBe('fail');
    expect(coverageOutcome(product.coverage, { stateId: '29', cityId: null, pincode: '560001' })).toBe('pass');
    expect(coverageOutcome(product.coverage, { stateId: '07', cityId: null, pincode: null })).toBe('pass');
    expect(coverageOutcome(product.coverage, { stateId: '27', cityId: 'mumbai', pincode: null })).toBe('fail');
    expect(coverageOutcome(product.coverage, { stateId: null, cityId: null, pincode: null })).toBe('unknown');
    expect(coverageOutcome({ ...product.coverage, nationwide: true }, { stateId: '27', cityId: null, pincode: null })).toBe('pass');
  });

  it('fails on hard mismatches and stays unknown when the case is incomplete', () => {
    const request = { category: 'business', segment: 'msme', subSegment: 'proprietorship', amountPaise: 100_000_000, tenureMonths: 24, location: { stateId: '06', cityId: null, pincode: null } };
    expect(screenProduct(product, request)).toEqual({ outcome: 'pass', reasons: [] });
    expect(screenProduct(product, { ...request, subSegment: 'llp', amountPaise: 10 }).reasons.map((reason) => reason.code)).toEqual(['sub_segment_mismatch', 'amount_out_of_range']);
    const partial = screenProduct(product, { ...request, subSegment: null, amountPaise: null, location: { stateId: null, cityId: null, pincode: null } });
    expect(partial).toEqual({ outcome: 'unknown', reasons: [{ code: 'sub_segment_unknown', outcome: 'unknown' }, { code: 'amount_unknown', outcome: 'unknown' }, { code: 'location_unknown', outcome: 'unknown' }] });
    expect(screenProduct(product, { ...request, category: 'home' }).outcome).toBe('fail');
  });
});

describe('product eligibility', () => {
  const director = facts({ 'bureau.score': [720, VERIFIED] });

  it('treats facts below the minimum provenance as unknown and asks for them', () => {
    const result = evaluateProduct(product, { primary: facts({ 'business.vintage_months': [36, DECLARED], 'business.annual_turnover_paise': [4_000_000_000, DECLARED], 'derived.foir': [0.4, 2] }), coApplicants: [], directors: [director] });
    expect(result.eligibility).toBe('needs_info');
    expect(result.hard.map((rule) => [rule.id, rule.outcome])).toEqual([['vintage', 'pass'], ['turnover', 'unknown'], ['directors', 'pass']]);
    expect(result.hard[0]?.message).toEqual({ en: 'Business vintage fits' });
    expect(result.missingAttributes).toEqual(['business.annual_turnover_paise']);
    expect(result).toMatchObject({ softScore: 3, softMax: 3 });
  });

  it('is eligible only when every hard rule passes for every party it names', () => {
    const primary = facts({ 'business.vintage_months': [36, DECLARED], 'business.annual_turnover_paise': [4_000_000_000, EXTRACTED] });
    expect(evaluateProduct(product, { primary, coApplicants: [], directors: [director] }).eligibility).toBe('eligible');
    expect(evaluateProduct(product, { primary, coApplicants: [], directors: [director, facts({ 'bureau.score': [600, VERIFIED] })] }).eligibility).toBe('ineligible');
    expect(evaluateProduct(product, { primary, coApplicants: [], directors: [] }).eligibility).toBe('needs_info');
    const young = evaluateProduct(product, { primary: facts({ 'business.vintage_months': [12, DECLARED] }), coApplicants: [], directors: [director] });
    expect(young).toMatchObject({ eligibility: 'ineligible', softScore: 0 });
    expect(young.hard[0]?.message).toEqual({ en: 'They need 2 years of history' });
  });

  it('lists every attribute the rules read', () => {
    expect(productAttributes(product)).toEqual(['business.vintage_months', 'business.annual_turnover_paise', 'bureau.score', 'derived.foir']);
  });
});
