import { describe, expect, it } from 'vitest';

import { localise, resolveLocale } from './locale.js';

describe('resolveLocale', () => {
  it('prefers the first supported candidate', () => {
    expect(resolveLocale(undefined, 'hi-IN,en;q=0.8')).toBe('hi');
    expect(resolveLocale('en', 'hi-IN')).toBe('en');
  });

  it('falls back to English for unsupported languages', () => {
    expect(resolveLocale('fr', 'de-DE')).toBe('en');
    expect(resolveLocale()).toBe('en');
  });
});

describe('localise', () => {
  it('returns the requested locale and falls back to English', () => {
    expect(localise({ en: 'Home Loan', hi: 'होम लोन' }, 'hi')).toBe('होम लोन');
    expect(localise({ en: 'Home Loan' }, 'hi')).toBe('Home Loan');
    expect(localise(null, 'en')).toBe('');
  });
});
