import { describe, expect, it } from 'vitest';

import { applyBps, computeCommission, schemeMatches, selectScheme } from './commission-math.js';
import { type CompiledCommissionScheme, SchemeBase, SchemeBasis, SchemeParty } from './commissions.types.js';

const LAKH = 100_000n * 100n;

const scheme = (overrides: Partial<CompiledCommissionScheme> = {}): CompiledCommissionScheme => ({
  party: SchemeParty.Lender,
  scope: { lenders: [], categories: [], partnerKinds: [], partnerLevels: [] },
  basis: SchemeBasis.Percent,
  base: SchemeBase.Disbursal,
  rateBps: 100,
  flatPaise: null,
  slabs: [],
  minPaise: null,
  capPaise: null,
  gstRateBps: 1800,
  tdsRateBps: 500,
  tdsNoPanRateBps: 2000,
  ...overrides,
});

describe('commission math', () => {
  it('applies basis points with half-up rounding in paise', () => {
    expect(applyBps(10n * LAKH, 100)).toBe(1_000_000n);
    expect(applyBps(333n, 1800)).toBe(60n);
    expect(applyBps(1n, 5000)).toBe(1n);
    expect(applyBps(0n, 1800)).toBe(0n);
    expect(() => applyBps(-1n, 100)).toThrow(RangeError);
  });

  it('computes percent, flat and slab commissions within the minimum and cap', () => {
    expect(computeCommission(scheme(), 20n * LAKH)).toBe(2_000_000n);
    expect(computeCommission(scheme({ basis: SchemeBasis.Flat, rateBps: null, flatPaise: 250_000 }), 20n * LAKH)).toBe(250_000n);
    const slabs = scheme({ basis: SchemeBasis.Slab, rateBps: null, slabs: [{ fromPaise: Number(25n * LAKH), rateBps: 150 }, { fromPaise: 0, rateBps: 100 }] });
    expect(computeCommission(slabs, 20n * LAKH)).toBe(2_000_000n);
    expect(computeCommission(slabs, 30n * LAKH)).toBe(4_500_000n);
    expect(computeCommission(scheme({ capPaise: 1_500_000 }), 20n * LAKH)).toBe(1_500_000n);
    expect(computeCommission(scheme({ minPaise: 500_000 }), LAKH)).toBe(500_000n);
    expect(computeCommission(scheme({ basis: SchemeBasis.Slab, rateBps: null, slabs: [{ fromPaise: Number(5n * LAKH), rateBps: 100 }] }), LAKH)).toBe(0n);
  });

  it('matches scopes and picks the most specific scheme of a party', () => {
    const context = { lenderKey: 'lenderx', category: 'business', partnerKind: 'ca', partnerLevel: 'active' };
    expect(schemeMatches(scheme({ scope: { lenders: ['lenderx'], categories: [], partnerKinds: [], partnerLevels: [] } }), context)).toBe(true);
    expect(schemeMatches(scheme({ scope: { lenders: ['lendery'], categories: [], partnerKinds: [], partnerLevels: [] } }), context)).toBe(false);
    expect(schemeMatches(scheme({ scope: { lenders: [], categories: ['home'], partnerKinds: [], partnerLevels: [] } }), { ...context, category: null })).toBe(false);
    const candidates = [
      { key: 'lender.default', compiled: scheme() },
      { key: 'lenderx.business', compiled: scheme({ scope: { lenders: ['lenderx'], categories: ['business'], partnerKinds: [], partnerLevels: [] } }) },
      { key: 'lenderx.all', compiled: scheme({ scope: { lenders: ['lenderx'], categories: [], partnerKinds: [], partnerLevels: [] } }) },
      { key: 'partner.ca', compiled: scheme({ party: SchemeParty.Partner, scope: { lenders: [], categories: [], partnerKinds: ['ca'], partnerLevels: [] } }) },
    ];
    expect(selectScheme(candidates, SchemeParty.Lender, context)?.key).toBe('lenderx.business');
    expect(selectScheme(candidates, SchemeParty.Lender, { ...context, lenderKey: 'other' })?.key).toBe('lender.default');
    expect(selectScheme(candidates, SchemeParty.Partner, context)?.key).toBe('partner.ca');
    expect(selectScheme(candidates, SchemeParty.Partner, { ...context, partnerKind: 'dsa' })).toBeNull();
  });
});
