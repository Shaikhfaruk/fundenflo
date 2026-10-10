import { describe, expect, it } from 'vitest';

import { formatDisplayDateTime, startOfDisplayDay, startOfDisplayMonth } from './date-format.js';

describe('display dates (India time)', () => {
  it('formats in IST and finds the start of the local day and month', () => {
    const at = new Date('2026-10-31T20:15:00.000Z');
    expect(formatDisplayDateTime(at)).toBe('1 Nov, 1:45 am');
    expect(startOfDisplayDay(at).toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(startOfDisplayMonth(at).toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(startOfDisplayMonth(new Date('2026-10-15T06:00:00.000Z')).toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });
});
