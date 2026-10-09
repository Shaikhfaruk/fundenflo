import { describe, expect, it } from 'vitest';

import { uuidv7 } from './uuid-v7.js';

describe('uuidv7', () => {
  it('produces RFC 9562 version 7 identifiers', () => {
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('sorts by creation time', () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_000_001);
    expect(earlier < later).toBe(true);
  });
});
