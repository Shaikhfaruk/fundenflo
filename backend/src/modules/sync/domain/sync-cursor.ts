import { SyncType, type SyncChange, type SyncCursor } from './sync.types.js';

type UpdatedAfter = { updatedAt?: { gt: Date } | { gte: Date }; OR?: Array<{ updatedAt: Date | { gt: Date }; id?: { gt: string } }> };

export function changedAfter(type: SyncType, cursor: SyncCursor | null): UpdatedAfter {
  if (!cursor) return {};
  if (type === cursor.type) return { OR: [{ updatedAt: { gt: cursor.at } }, { updatedAt: cursor.at, id: { gt: cursor.id } }] };
  return type > cursor.type ? { updatedAt: { gte: cursor.at } } : { updatedAt: { gt: cursor.at } };
}

export const compareChanges = (left: SyncChange, right: SyncChange) =>
  left.updatedAt.getTime() - right.updatedAt.getTime() || left.type.localeCompare(right.type) || left.id.localeCompare(right.id);

export function encodeCursor(change: SyncChange): string {
  return Buffer.from(JSON.stringify({ a: change.updatedAt.toISOString(), t: change.type, i: change.id })).toString('base64url');
}

export function decodeCursor(value: string): SyncCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { a?: unknown; t?: unknown; i?: unknown };
    const at = typeof parsed.a === 'string' ? new Date(parsed.a) : null;
    const type = Object.values(SyncType).find((candidate) => candidate === parsed.t);
    if (!at || Number.isNaN(at.getTime()) || !type || typeof parsed.i !== 'string') return null;
    return { at, type, id: parsed.i };
  } catch {
    return null;
  }
}
