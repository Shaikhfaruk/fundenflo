import { describe, expect, it } from 'vitest';

import { isStale, resolveFact } from './resolve-fact.js';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 3600_000);
const fact = (id: string, rank: number, ageDays: number, validUntil: Date | null = null) => ({ id, rank, observedAt: daysAgo(ageDays), validUntil });

describe('resolveFact', () => {
  it('prefers the higher-ranked source over a more recent lower-ranked one', () => {
    expect(resolveFact([fact('declared', 1, 1), fact('verified', 5, 20)], null, NOW)?.fact.id).toBe('verified');
  });

  it('uses recency between facts of the same rank', () => {
    expect(resolveFact([fact('older', 3, 10), fact('newer', 3, 2)], null, NOW)?.fact.id).toBe('newer');
  });

  it('prefers a fresh fact over a stale higher-ranked one and flags staleness', () => {
    const resolved = resolveFact([fact('old-verified', 5, 200), fact('fresh-declared', 1, 5)], 180, NOW);
    expect(resolved).toMatchObject({ fact: { id: 'fresh-declared' }, stale: false });
    expect(resolveFact([fact('old-verified', 5, 200)], 180, NOW)).toMatchObject({ fact: { id: 'old-verified' }, stale: true });
  });

  it('ignores facts past their validity and returns nothing when none remain', () => {
    expect(resolveFact([fact('expired', 5, 1, daysAgo(0.5)), fact('valid', 1, 3)], null, NOW)?.fact.id).toBe('valid');
    expect(resolveFact([fact('expired', 5, 1, daysAgo(0.5))], null, NOW)).toBeUndefined();
  });

  it('treats missing freshness as never stale', () => {
    expect(isStale(daysAgo(5_000), null, NOW)).toBe(false);
    expect(isStale(daysAgo(31), 30, NOW)).toBe(true);
  });
});
