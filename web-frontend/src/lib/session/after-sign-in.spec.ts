import { describe, expect, it } from 'vitest';

import type { SessionPayload } from '@/lib/api/types/auth.types';
import { destinationAfterSignIn } from './after-sign-in';

const payload = (context: string | null, code: string | null = null): SessionPayload => ({
  expiresAt: 0,
  nextAction: code ? { code, message: '' } : null,
  user: { id: 'u', status: 'active', fullName: null, preferredLanguage: null, mobile: null, email: null, profileComplete: false, version: 1, activeContext: context ? { membershipId: 'm', context, role: 'r', organization: null } : null, memberships: [], logins: [] },
});

describe('destinationAfterSignIn', () => {
  it('sends each context to its home', () => {
    expect(destinationAfterSignIn(payload('borrower'), null)).toBe('/app');
    expect(destinationAfterSignIn(payload('partner'), null)).toBe('/partner');
    expect(destinationAfterSignIn(payload('lender'), null)).toBe('/lender');
    expect(destinationAfterSignIn(payload('staff'), null)).toBe('/ops/leads');
  });

  it('follows next actions before the requested page', () => {
    expect(destinationAfterSignIn(payload(null, 'PARTNER_NOT_ONBOARDED'), '/app')).toBe('/partner/signup');
    expect(destinationAfterSignIn(payload(null, 'MEMBERSHIP_REQUIRED'), '/app')).toBe('/account/switch');
  });

  it('only returns to safe same-site paths', () => {
    expect(destinationAfterSignIn(payload('borrower'), '/app/applications/new')).toBe('/app/applications/new');
    expect(destinationAfterSignIn(payload('borrower'), '//evil.example')).toBe('/app');
    expect(destinationAfterSignIn(payload('borrower'), 'https://evil.example')).toBe('/app');
    expect(destinationAfterSignIn(payload('borrower'), '/api/v1/me')).toBe('/app');
  });
});
