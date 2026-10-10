import { describe, expect, it } from 'vitest';

import type { RankedLookup } from '../facts/resolve-fact.js';
import { type CompiledLenderProduct, RuleParty } from '../lending/lending.types.js';
import { matchProducts } from './match-products.js';

const base: CompiledLenderProduct = {
  lenderId: 'lender-a',
  lenderKey: 'lendera',
  productKey: 'wc',
  category: 'business',
  segments: ['msme'],
  subSegments: [],
  amountPaise: { min: 1, max: 1_000_000_000 },
  tenureMonths: { min: 6, max: 60 },
  coverage: { nationwide: true, stateIds: [], cityIds: [], includePincodes: [], excludePincodes: [] },
  hard: [{ id: 'vintage', when: { attr: 'business.vintage_months', op: 'gte', value: 24 }, minRank: null, party: RuleParty.Primary, pass: { en: 'Vintage fits' }, fail: null }],
  soft: [{ id: 'gst', weight: 2, when: { attr: 'business.gst_registered', op: 'eq', value: true }, minRank: null, party: RuleParty.Primary, pass: { en: 'GST registered' }, fail: null }],
  documents: [{ key: 'udyam', documentTypes: ['udyam_certificate'], required: true, minCount: 1, when: null, label: null, description: null, stage: 'submission' }],
  questionSet: null,
  pricingDisclosure: null,
};

const facts = (entries: Record<string, unknown>): RankedLookup => (attr) => (attr in entries ? { value: entries[attr] as number, rank: 1 } : undefined);

const request = { category: 'business', segment: 'msme', subSegment: 'proprietorship', amountPaise: 2_000_000, tenureMonths: 24, location: { stateId: 's', cityId: null, pincode: null } };

describe('matching engine', () => {
  it('ranks eligible products first by fit, then those needing information, then the rest', () => {
    const candidates = [
      { productDocumentId: 'p1', productKey: 'a.strict', productVersionId: 'v1', product: { ...base, hard: [{ ...base.hard[0]!, when: { attr: 'business.vintage_months', op: 'gte' as const, value: 60 } }] } },
      { productDocumentId: 'p2', productKey: 'b.open', productVersionId: 'v2', product: base },
      { productDocumentId: 'p3', productKey: 'c.nosoft', productVersionId: 'v3', product: { ...base, soft: [], documents: [] } },
      { productDocumentId: 'p4', productKey: 'd.turnover', productVersionId: 'v4', product: { ...base, hard: [{ id: 'turnover', when: { attr: 'business.monthly_turnover_paise', op: 'gte' as const, value: 1 }, minRank: null, party: RuleParty.Primary, pass: null, fail: null }] } },
    ];
    const results = matchProducts(candidates, { request, lookups: { primary: facts({ 'business.vintage_months': 36, 'business.gst_registered': false }), coApplicants: [], directors: [] }, heldDocumentTypes: new Set(), documentStages: ['assessment', 'submission'] });
    expect(results.map((result) => [result.productKey, result.outcome, result.fit, result.rank])).toEqual([
      ['c.nosoft', 'eligible', 100, 1],
      ['b.open', 'eligible', 0, 2],
      ['d.turnover', 'needs_info', 0, 3],
      ['a.strict', 'ineligible', 0, 4],
    ]);
    expect(results[1]).toMatchObject({ reasons: [{ en: 'They lend in your area' }, { en: 'Vintage fits' }], documentsNeeded: ['udyam'] });
  });

  it('counts documents already held and fails products outside the request', () => {
    const [held] = matchProducts([{ productDocumentId: 'p2', productKey: 'b.open', productVersionId: 'v2', product: base }], { request, lookups: { primary: facts({ 'business.vintage_months': 36 }), coApplicants: [], directors: [] }, heldDocumentTypes: new Set(['udyam_certificate']), documentStages: ['submission'] });
    expect(held?.documentsNeeded).toEqual([]);
    const [outside] = matchProducts([{ productDocumentId: 'p2', productKey: 'b.open', productVersionId: 'v2', product: base }], { request: { ...request, category: 'home' }, lookups: { primary: facts({ 'business.vintage_months': 36 }), coApplicants: [], directors: [] }, heldDocumentTypes: new Set(), documentStages: ['submission'] });
    expect(outside).toMatchObject({ outcome: 'ineligible', reasons: [{ en: 'Vintage fits' }] });
  });
});
