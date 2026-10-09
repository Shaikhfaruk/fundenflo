import type { MatchDecision } from './decide.js';
import { NAME_HONORIFICS } from './party-matching.constants.js';

export type LeadMatchCandidate = { partyId: string; displayName: string | null; verified: boolean };

const nameTokens = (name: string | null | undefined): string[] =>
  (name ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !NAME_HONORIFICS.has(token));

export function namesCompatible(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftTokens = nameTokens(left);
  const rightTokens = new Set(nameTokens(right));
  if (leftTokens.length === 0 || rightTokens.size === 0) return true;
  return leftTokens.some((token) => rightTokens.has(token));
}

export function decideLeadMatch(candidates: readonly LeadMatchCandidate[], name: string | null | undefined): MatchDecision {
  const unique = new Map<string, LeadMatchCandidate>();
  for (const candidate of candidates) {
    const existing = unique.get(candidate.partyId);
    unique.set(candidate.partyId, { ...candidate, verified: candidate.verified || (existing?.verified ?? false) });
  }
  if (unique.size === 0) return { outcome: 'none' };
  const compatible = [...unique.values()].filter((candidate) => namesCompatible(candidate.displayName, name));
  const [only] = compatible;
  if (compatible.length === 1 && only) return { outcome: 'single', partyId: only.partyId };
  const verified = compatible.filter((candidate) => candidate.verified);
  const [verifiedOnly] = verified;
  if (verified.length === 1 && verifiedOnly) return { outcome: 'single', partyId: verifiedOnly.partyId };
  return { outcome: 'multiple', partyIds: [...unique.keys()] };
}
