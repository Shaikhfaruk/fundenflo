import { describe, expect, it } from 'vitest';

import { decideMatch } from './decide.js';
import { decideLeadMatch, namesCompatible } from './lead-match.js';
import { maskEmail, maskMobile } from './mask.js';
import { normaliseEmail, normaliseLandline, normaliseMobile } from './normalise.js';

describe('normaliseMobile', () => {
  it('accepts a 10-digit Indian mobile with the frontend country code', () => {
    expect(normaliseMobile('98765 43210', '+91')).toEqual({ e164: '+919876543210', nationalNumber: '9876543210', countryCallingCode: '91' });
  });

  it('accepts E.164 input without a country code', () => {
    expect(normaliseMobile('+919876543210')?.e164).toBe('+919876543210');
  });

  it('defaults to India for bare national numbers', () => {
    expect(normaliseMobile('9876543210')?.e164).toBe('+919876543210');
  });

  it('rejects numbers that are not valid mobiles', () => {
    expect(normaliseMobile('12345')).toBeNull();
    expect(normaliseMobile('0112345678', '+91')).toBeNull();
    expect(normaliseMobile('')).toBeNull();
  });
});

describe('normaliseEmail', () => {
  it('lowercases and trims', () => {
    expect(normaliseEmail('  Ops.Lead@Example.COM ')).toBe('ops.lead@example.com');
  });

  it('rejects malformed addresses', () => {
    expect(normaliseEmail('not-an-email')).toBeNull();
    expect(normaliseEmail('a@b')).toBeNull();
  });
});

describe('masking', () => {
  it('keeps the first two and last three digits of a mobile', () => {
    expect(maskMobile('+919876543210')).toBe('+91 98•••••210');
  });

  it('keeps the first two characters of an email local part', () => {
    expect(maskEmail('ops.lead@example.com')).toBe('op•••@example.com');
    expect(maskEmail('a@example.com')).toBe('a•••@example.com');
  });
});

describe('decideMatch', () => {
  it('returns none when every candidate already has a login', () => {
    expect(decideMatch([{ partyId: 'p1', hasLogin: true }])).toEqual({ outcome: 'none' });
  });

  it('returns the single unclaimed party', () => {
    expect(decideMatch([{ partyId: 'p1', hasLogin: false }, { partyId: 'p2', hasLogin: true }])).toEqual({ outcome: 'single', partyId: 'p1' });
  });

  it('deduplicates repeated candidates', () => {
    expect(decideMatch([{ partyId: 'p1', hasLogin: false }, { partyId: 'p1', hasLogin: false }])).toEqual({ outcome: 'single', partyId: 'p1' });
  });

  it('returns multiple when more than one unclaimed party matches', () => {
    expect(decideMatch([{ partyId: 'p1', hasLogin: false }, { partyId: 'p2', hasLogin: false }])).toEqual({ outcome: 'multiple', partyIds: ['p1', 'p2'] });
  });
});

describe('lead matching', () => {
  it('ignores honorifics and punctuation when comparing names', () => {
    expect(namesCompatible('Mr. Ramesh Kumar', 'ramesh k')).toBe(true);
    expect(namesCompatible('Smt Sunita Devi', 'Ramesh Kumar')).toBe(false);
    expect(namesCompatible(null, 'Ramesh')).toBe(true);
  });

  it('links one compatible party, prefers a single verified one, and asks for review otherwise', () => {
    expect(decideLeadMatch([], 'Ramesh')).toEqual({ outcome: 'none' });
    expect(decideLeadMatch([{ partyId: 'p1', displayName: 'Ramesh Kumar', verified: false }], 'Ramesh')).toEqual({ outcome: 'single', partyId: 'p1' });
    expect(decideLeadMatch([{ partyId: 'p1', displayName: 'Sunita Devi', verified: true }], 'Ramesh Kumar')).toEqual({ outcome: 'multiple', partyIds: ['p1'] });
    expect(
      decideLeadMatch([{ partyId: 'p1', displayName: 'Ramesh', verified: false }, { partyId: 'p2', displayName: 'Ramesh K', verified: true }], 'Ramesh'),
    ).toEqual({ outcome: 'single', partyId: 'p2' });
    expect(
      decideLeadMatch([{ partyId: 'p1', displayName: 'Ramesh', verified: false }, { partyId: 'p2', displayName: 'Ramesh K', verified: false }], 'Ramesh'),
    ).toEqual({ outcome: 'multiple', partyIds: ['p1', 'p2'] });
  });

  it('normalises Indian landlines and rejects mobiles as landlines', () => {
    expect(normaliseLandline('011 2345 6789')).toBe('+911123456789');
    expect(normaliseLandline('9876543210')).toBeNull();
  });
});
