import { describe, expect, it } from 'vitest';

import type { AssignmentCandidate } from './assignment.types.js';
import { eligibleCandidates, pickAssignees } from './pick-assignees.js';

const at = (minutesAgo: number | null) => (minutesAgo === null ? null : new Date(Date.UTC(2026, 9, 10, 12) - minutesAgo * 60_000));
const ca = (id: string, overrides: Partial<AssignmentCandidate> = {}): AssignmentCandidate => ({ id, weight: 1, openCount: 0, capacity: null, lastAssignedAt: null, previouslyWorked: false, ...overrides });

const pool = [ca('a', { lastAssignedAt: at(10), openCount: 4, capacity: 10 }), ca('b', { lastAssignedAt: at(60), openCount: 9, capacity: 10 }), ca('c', { lastAssignedAt: null, openCount: 1, capacity: 2 })];

describe('pickAssignees', () => {
  it('skips CAs that are full or excluded', () => {
    expect(eligibleCandidates([...pool, ca('d', { openCount: 5, capacity: 5 })], new Set(['c'])).map((candidate) => candidate.id)).toEqual(['a', 'b']);
    expect(pickAssignees({ strategy: 'round_robin', candidates: [ca('x', { openCount: 3, capacity: 3 })] })).toEqual([]);
  });

  it('round-robin offers the CA who waited longest, never assigned first', () => {
    expect(pickAssignees({ strategy: 'round_robin', candidates: pool })).toEqual(['c']);
    expect(pickAssignees({ strategy: 'round_robin', candidates: pool, excluded: new Set(['c']) })).toEqual(['b']);
  });

  it('least-loaded uses open leads against capacity', () => {
    expect(pickAssignees({ strategy: 'least_loaded', candidates: pool })).toEqual(['a']);
  });

  it('weighted picks in proportion to weight', () => {
    const weighted = [ca('low', { weight: 1 }), ca('high', { weight: 3 })];
    expect(pickAssignees({ strategy: 'weighted', candidates: weighted, random: () => 0.1 })).toEqual(['low']);
    expect(pickAssignees({ strategy: 'weighted', candidates: weighted, random: () => 0.5 })).toEqual(['high']);
    expect(pickAssignees({ strategy: 'weighted', candidates: [ca('zero', { weight: 0 }), ca('none', { weight: 0, lastAssignedAt: at(5) })], random: () => 0.5 })).toEqual(['zero']);
  });

  it('broadcast offers several at once; sticky prefers the CA who worked the person before', () => {
    expect(pickAssignees({ strategy: 'broadcast', candidates: pool, offers: 2 })).toEqual(['c', 'b']);
    expect(pickAssignees({ strategy: 'sticky', candidates: [...pool, ca('old', { previouslyWorked: true, lastAssignedAt: at(500) })] })).toEqual(['old']);
    expect(pickAssignees({ strategy: 'sticky', candidates: pool })).toEqual(['c']);
  });

  it('leaves manual and pool rules to people', () => {
    expect(pickAssignees({ strategy: 'manual', candidates: pool })).toEqual([]);
    expect(pickAssignees({ strategy: 'pool', candidates: pool })).toEqual([]);
  });
});
