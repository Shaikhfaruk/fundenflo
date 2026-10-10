import { describe, expect, it } from 'vitest';

import { consentAllows, type ConsentEvent, foldConsent } from './fold-consent.js';
import { MINUTE_MS } from '../../common/constants/time.constants.js';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE_MS);
let counter = 0;
const event = (granted: boolean, minutes: number, organizationIds: string[] | null = null, expiresAt: Date | null = null): ConsentEvent => ({
  id: `e${(counter += 1)}`,
  granted,
  organizationIds,
  recordedAt: at(minutes),
  expiresAt,
});

describe('foldConsent', () => {
  it('starts withdrawn and follows the latest unscoped decision', () => {
    expect(foldConsent([], NOW)).toMatchObject({ granted: false, lastEventId: null });
    expect(foldConsent([event(true, -30), event(false, -20)], NOW).granted).toBe(false);
    expect(foldConsent([event(false, -20), event(true, -10)], NOW)).toMatchObject({ granted: true, everyOrganization: true });
  });

  it('orders by recorded time, not by input order', () => {
    expect(foldConsent([event(true, -5), event(false, -50)], NOW).granted).toBe(true);
  });

  it('tracks organization scopes, exclusions and explicit-only checks', () => {
    const scoped = foldConsent([event(true, -30, ['lender-a']), event(true, -20, ['lender-b']), event(false, -10, ['lender-a'])], NOW);
    expect(scoped).toMatchObject({ granted: true, everyOrganization: false, organizationIds: ['lender-b'] });
    expect(consentAllows(scoped, 'lender-a')).toBe(false);
    expect(consentAllows(scoped, 'lender-b')).toBe(true);

    const general = foldConsent([event(true, -30), event(false, -20, ['partner-x'])], NOW);
    expect(consentAllows(general, 'partner-y')).toBe(true);
    expect(consentAllows(general, 'partner-x')).toBe(false);
    expect(consentAllows(general, 'partner-y', { explicitOnly: true })).toBe(false);
    expect(consentAllows(foldConsent([event(true, -30), event(false, -20, ['p']), event(true, -10, ['p'])], NOW), 'p', { explicitOnly: true })).toBe(true);
  });

  it('ignores expired grants and clears everything on an unscoped withdrawal', () => {
    expect(foldConsent([event(true, -30, null, at(-1))], NOW).granted).toBe(false);
    expect(foldConsent([event(true, -30, null, at(60))], NOW)).toMatchObject({ granted: true, expiresAt: at(60) });
    expect(foldConsent([event(true, -30, ['a', 'b']), event(false, -10)], NOW)).toMatchObject({ granted: false, organizationIds: [], expiresAt: null });
  });
});
