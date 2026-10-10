import { describe, expect, it } from 'vitest';

import { changedAfter, compareChanges, cursorAt, decodeCursor, encodeCursor } from './sync-cursor.js';
import { SyncType } from './sync.types.js';

const at = new Date('2026-10-10T10:00:00.000Z');

describe('sync cursor', () => {
  it('round-trips and rejects tampered cursors', () => {
    const cursor = encodeCursor({ type: SyncType.Lead, id: 'b', version: 3, updatedAt: at });
    expect(decodeCursor(cursor)).toEqual({ at, type: 'lead', id: 'b' });
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ a: 'x', t: 'lead', i: 'b' })).toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ a: at.toISOString(), t: 'payout', i: 'b' })).toString('base64url'))).toBeNull();
  });

  it('continues after the cursor in (updatedAt, type, id) order without gaps or repeats', () => {
    const cursor = { at, type: SyncType.Lead, id: 'b' };
    expect(changedAfter(SyncType.Lead, cursor)).toEqual({ OR: [{ updatedAt: { gt: at } }, { updatedAt: at, id: { gt: 'b' } }] });
    expect(changedAfter(SyncType.Assignment, cursor)).toEqual({ updatedAt: { gt: at } });
    expect(changedAfter(SyncType.FollowUp, cursor)).toEqual({ updatedAt: { gt: at } });
    expect(changedAfter(SyncType.Lead, null)).toEqual({});
    const later = new Date(at.getTime() + 1);
    const sorted = [
      { type: SyncType.Lead, id: 'a', version: 1, updatedAt: later },
      { type: SyncType.Lead, id: 'c', version: 1, updatedAt: at },
      { type: SyncType.Assignment, id: 'z', version: 1, updatedAt: at },
    ].toSorted(compareChanges);
    expect(sorted.map((change) => `${change.type}:${change.id}`)).toEqual(['assignment:z', 'lead:c', 'lead:a']);
  });

  it('starts a time cursor before every change made at or after that time', () => {
    const cursor = cursorAt(at);
    expect(changedAfter(SyncType.Assignment, cursor)).toEqual({ OR: [{ updatedAt: { gt: at } }, { updatedAt: at, id: { gt: '' } }] });
    expect(changedAfter(SyncType.FollowUp, cursor)).toEqual({ updatedAt: { gte: at } });
    expect(changedAfter(SyncType.Lead, cursor)).toEqual({ updatedAt: { gte: at } });
  });
});
