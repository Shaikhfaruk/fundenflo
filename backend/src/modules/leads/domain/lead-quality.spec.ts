import { describe, expect, it } from 'vitest';

import { scoreLead } from './lead-quality.js';

const empty = { hasMobile: false, hasEmail: false, hasName: false, segmentKey: null, categoryKey: null, hasAmount: false, locationResolved: false, consentOk: false };

describe('scoreLead', () => {
  it('scores an empty lead zero and a complete one 100', () => {
    expect(scoreLead(empty)).toBe(0);
    expect(scoreLead({ hasMobile: true, hasEmail: true, hasName: true, segmentKey: 'msme', categoryKey: 'business', hasAmount: true, locationResolved: true, consentOk: true })).toBe(100);
  });

  it('weights a reachable mobile and a known category highest', () => {
    expect(scoreLead({ ...empty, hasMobile: true })).toBe(25);
    expect(scoreLead({ ...empty, hasMobile: true, categoryKey: 'business', locationResolved: true })).toBe(55);
  });
});
