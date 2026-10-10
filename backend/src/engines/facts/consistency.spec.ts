import { describe, expect, it } from 'vitest';

import { compareFacts, severityOf } from './consistency.js';

describe('fact consistency', () => {
  it('accepts observed values inside a declared bucket and measures the gap outside it', () => {
    expect(compareFacts({ min: 50, max: 250 }, 120, 20)).toEqual({ deviates: false, deviationPct: 0 });
    expect(compareFacts({ min: 50, max: 250 }, 280, 20)).toEqual({ deviates: false, deviationPct: 12 });
    expect(compareFacts({ min: 50, max: 250 }, 30, 20)).toEqual({ deviates: true, deviationPct: 40 });
    expect(compareFacts(100, 400, 20)).toEqual({ deviates: true, deviationPct: 300 });
    expect(compareFacts({ min: 60, max: null }, 10, 20)).toEqual({ deviates: true, deviationPct: 83.33 });
  });

  it('compares categorical values exactly and grades severity', () => {
    expect(compareFacts(true, false, 20)).toEqual({ deviates: true, deviationPct: null });
    expect(compareFacts(['a', 'b'], ['b', 'a'], 20).deviates).toBe(false);
    expect(compareFacts(null, 5, 20).deviates).toBe(false);
    expect([severityOf(null, 50, 100), severityOf(30, 50, 100), severityOf(60, 50, 100), severityOf(300, 50, 100)]).toEqual(['medium', 'low', 'medium', 'high']);
  });
});
