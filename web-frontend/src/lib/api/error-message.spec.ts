import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { errorMessage } from './error-message';

const t = (key: string, values?: Record<string, string | number>) => (values ? `${key}:${JSON.stringify(values)}` : key);

describe('errorMessage', () => {
  it('shows the first specific reason of a validation error as a sentence', () => {
    const error = new ApiError(400, { code: 'VALIDATION_FAILED', message: 'Some fields are missing or invalid.', details: [{ path: 'parties', code: 'two_logins', message: 'both parties have their own login' }] });
    expect(errorMessage(error, t, (key) => !key.startsWith('issues.'))).toBe('Both parties have their own login.');
  });

  it('prefers a translated message for a known validation issue code', () => {
    const error = new ApiError(400, { code: 'VALIDATION_FAILED', message: 'Some fields are missing or invalid.', details: [{ path: 'risk', code: 'risk_hold', message: 'fraud review 01a1 must be cleared first' }] });
    expect(errorMessage(error, t, (key) => key === 'issues.risk_hold')).toBe('issues.risk_hold');
  });

  it('falls back to the translated code, then the server message', () => {
    expect(errorMessage(new ApiError(409, { code: 'DOCUMENT_LOCKED', message: 'Locked' }), t, (key) => key === 'DOCUMENT_LOCKED')).toBe('DOCUMENT_LOCKED');
    expect(errorMessage(new ApiError(500, { code: 'UNKNOWN', message: 'Server says no' }), t, () => false)).toBe('Server says no');
    expect(errorMessage(new Error('boom'), t, () => true)).toBe('generic');
  });
});
