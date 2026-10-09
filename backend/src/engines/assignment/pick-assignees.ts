import { AssignmentStrategy, type AssignmentCandidate, type PickRequest } from './assignment.types.js';

const hasRoom = (candidate: AssignmentCandidate) => candidate.capacity === null || candidate.openCount < candidate.capacity;

const leastRecentFirst = (left: AssignmentCandidate, right: AssignmentCandidate) =>
  (left.lastAssignedAt?.getTime() ?? 0) - (right.lastAssignedAt?.getTime() ?? 0) || left.id.localeCompare(right.id);

const load = (candidate: AssignmentCandidate) => (candidate.capacity ? candidate.openCount / candidate.capacity : candidate.openCount);

function weightedPick(candidates: AssignmentCandidate[], random: () => number): AssignmentCandidate | undefined {
  const positive = candidates.filter((candidate) => candidate.weight > 0);
  const total = positive.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) return candidates.toSorted(leastRecentFirst)[0];
  let ticket = random() * total;
  for (const candidate of positive) {
    ticket -= candidate.weight;
    if (ticket < 0) return candidate;
  }
  return positive.at(-1);
}

export function eligibleCandidates(candidates: readonly AssignmentCandidate[], excluded: ReadonlySet<string> = new Set()): AssignmentCandidate[] {
  return candidates.filter((candidate) => !excluded.has(candidate.id) && hasRoom(candidate));
}

const leastRecent = (eligible: AssignmentCandidate[], count = 1) => eligible.toSorted(leastRecentFirst).slice(0, count).map((candidate) => candidate.id);

const STRATEGIES: Record<AssignmentStrategy, (eligible: AssignmentCandidate[], request: PickRequest) => string[]> = {
  [AssignmentStrategy.Manual]: () => [],
  [AssignmentStrategy.Pool]: () => [],
  [AssignmentStrategy.Sticky]: (eligible) => {
    const previous = eligible.filter((candidate) => candidate.previouslyWorked).toSorted(leastRecentFirst).at(-1);
    return previous ? [previous.id] : leastRecent(eligible);
  },
  [AssignmentStrategy.RoundRobin]: (eligible) => leastRecent(eligible),
  [AssignmentStrategy.LeastLoaded]: (eligible) =>
    eligible
      .toSorted((left, right) => load(left) - load(right) || leastRecentFirst(left, right))
      .slice(0, 1)
      .map((candidate) => candidate.id),
  [AssignmentStrategy.Weighted]: (eligible, request) => {
    const chosen = weightedPick(eligible, request.random ?? Math.random);
    return chosen ? [chosen.id] : [];
  },
  [AssignmentStrategy.Broadcast]: (eligible, request) => leastRecent(eligible, Math.max(1, request.offers ?? 1)),
};

export function pickAssignees(request: PickRequest): string[] {
  const eligible = eligibleCandidates(request.candidates, request.excluded);
  return eligible.length === 0 ? [] : STRATEGIES[request.strategy](eligible, request);
}
