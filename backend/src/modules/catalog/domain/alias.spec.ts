import { describe, expect, it } from 'vitest';

import { normaliseLookupText } from './alias.js';

describe('normaliseLookupText', () => {
  it('lowercases, strips punctuation and collapses spaces', () => {
    expect(normaliseLookupText('  Gurgaon,  Haryana ')).toBe('gurgaon haryana');
    expect(normaliseLookupText('Working-Capital')).toBe('working capital');
  });

  it('keeps non-Latin letters', () => {
    expect(normaliseLookupText('दिल्ली')).toBe('दिल्ली');
  });
});
