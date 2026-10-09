export type MatchCandidate = {
  partyId: string;
  hasLogin: boolean;
};

export type MatchDecision =
  | { outcome: 'none' }
  | { outcome: 'single'; partyId: string }
  | { outcome: 'multiple'; partyIds: string[] };

export function decideMatch(candidates: MatchCandidate[]): MatchDecision {
  const unique = [...new Map(candidates.filter((candidate) => !candidate.hasLogin).map((c) => [c.partyId, c])).values()];
  const [first] = unique;
  if (!first) return { outcome: 'none' };
  if (unique.length === 1) return { outcome: 'single', partyId: first.partyId };
  return { outcome: 'multiple', partyIds: unique.map((candidate) => candidate.partyId) };
}
