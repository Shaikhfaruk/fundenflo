import { describe, expect, it } from 'vitest';

import { mapInSequence } from './in-sequence.js';

describe('mapInSequence', () => {
  it('runs one item at a time and keeps the order', async () => {
    const started: number[] = [];
    let running = 0;
    let peak = 0;
    const results = await mapInSequence([3, 1, 2], async (value) => {
      started.push(value);
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, value));
      running -= 1;
      return value * 10;
    });
    expect(results).toEqual([30, 10, 20]);
    expect(started).toEqual([3, 1, 2]);
    expect(peak).toBe(1);
  });
});
