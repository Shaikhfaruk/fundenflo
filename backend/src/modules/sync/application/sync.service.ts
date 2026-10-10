import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { compareChanges, cursorAt, decodeCursor, encodeCursor } from '../domain/sync-cursor.js';
import type { SyncChange, SyncScope, SyncType } from '../domain/sync.types.js';
import { SyncSourceRegistry } from './sync-source.registry.js';

@Injectable()
export class SyncService {
  constructor(private readonly registry: SyncSourceRegistry) {}

  async changes(scope: SyncScope, request: { since?: string; updatedSince?: Date; types?: SyncType[]; limit: number }) {
    const cursor = request.since ? decodeCursor(request.since) : request.updatedSince ? cursorAt(request.updatedSince) : null;
    if (request.since && !cursor) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'since', code: 'invalid_cursor', message: 'use nextCursor from an earlier response' }] });
    const types = request.types ?? this.registry.types();
    const unknown = types.filter((type) => !this.registry.get(type));
    if (unknown.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: unknown.map((type) => ({ path: 'types', code: 'unknown_type', message: `nothing syncs as ${type}` })) });
    const found: SyncChange[] = [];
    for (const type of types) found.push(...((await this.registry.get(type)?.changes(scope, cursor, request.limit + 1)) ?? []));
    const ordered = found.toSorted(compareChanges);
    const page = ordered.slice(0, request.limit);
    const last = page.at(-1);
    return {
      items: page.map((change) => ({ type: change.type, id: change.id, version: change.version, updatedAt: change.updatedAt.toISOString() })),
      nextCursor: last ? encodeCursor(last) : (request.since ?? null),
      hasMore: ordered.length > request.limit,
    };
  }
}
