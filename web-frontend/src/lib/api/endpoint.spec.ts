import { describe, expect, it } from 'vitest';

import { endpoint, queryString } from './endpoint';

describe('endpoint', () => {
  it('fills and encodes path parameters', () => {
    expect(endpoint('GET /ops/parties/:partyId/facts', { partyId: 'a b/c' })).toEqual({ method: 'GET', path: '/ops/parties/a%20b%2Fc/facts' });
    expect(endpoint('POST /admin/question-sets/:id/versions/:number/publish', { id: 'qs-1', number: 3 })).toEqual({ method: 'POST', path: '/admin/question-sets/qs-1/versions/3/publish' });
  });

  it('refuses a missing parameter', () => {
    expect(() => endpoint('GET /applications/:id')).toThrow(/Missing path parameter id/);
  });
});

describe('queryString', () => {
  it('drops empty values and repeats arrays', () => {
    expect(queryString({ status: ['new', 'qualified'], q: '', limit: 25, cursor: null, flag: undefined })).toBe('?status=new&status=qualified&limit=25');
    expect(queryString({})).toBe('');
  });
});
