import { BPS_DENOMINATOR, type CompiledCommissionScheme, SchemeBasis, type SchemeContext, type SchemeParty, type SchemeScope } from './commissions.types.js';

const HALF = BPS_DENOMINATOR / 2n;

export function applyBps(amount: bigint, bps: number): bigint {
  if (amount < 0n) throw new RangeError('amount must not be negative');
  return (amount * BigInt(bps) + HALF) / BPS_DENOMINATOR;
}

function rateFor(scheme: CompiledCommissionScheme, base: bigint): bigint {
  if (scheme.basis === SchemeBasis.Flat) return BigInt(scheme.flatPaise ?? 0);
  if (scheme.basis === SchemeBasis.Percent) return applyBps(base, scheme.rateBps ?? 0);
  const slab = scheme.slabs.toSorted((left, right) => left.fromPaise - right.fromPaise).findLast((candidate) => BigInt(candidate.fromPaise) <= base);
  return slab ? applyBps(base, slab.rateBps) : 0n;
}

export function computeCommission(scheme: CompiledCommissionScheme, base: bigint): bigint {
  let amount = rateFor(scheme, base);
  if (scheme.minPaise !== null && amount < BigInt(scheme.minPaise)) amount = BigInt(scheme.minPaise);
  if (scheme.capPaise !== null && amount > BigInt(scheme.capPaise)) amount = BigInt(scheme.capPaise);
  return amount;
}

const SCOPE_FIELDS: ReadonlyArray<[keyof SchemeScope, keyof SchemeContext]> = [
  ['lenders', 'lenderKey'],
  ['categories', 'category'],
  ['partnerKinds', 'partnerKind'],
  ['partnerLevels', 'partnerLevel'],
];

export function schemeMatches(scheme: CompiledCommissionScheme, context: SchemeContext): boolean {
  return SCOPE_FIELDS.every(([field, key]) => {
    const allowed = scheme.scope[field];
    const value = context[key];
    return allowed.length === 0 || (value !== null && allowed.includes(value));
  });
}

const specificity = (scheme: CompiledCommissionScheme) => SCOPE_FIELDS.filter(([field]) => scheme.scope[field].length > 0).length;

export function selectScheme<T extends { key: string; compiled: CompiledCommissionScheme }>(candidates: readonly T[], party: SchemeParty, context: SchemeContext): T | null {
  return candidates.filter((candidate) => candidate.compiled.party === party && schemeMatches(candidate.compiled, context)).toSorted((left, right) => specificity(right.compiled) - specificity(left.compiled) || left.key.localeCompare(right.key))[0] ?? null;
}
