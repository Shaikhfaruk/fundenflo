import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/listing.constants.js';

export const pageQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PageQuery = z.output<typeof pageQuerySchema>;

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

export function pageWindow(query: PageQuery) {
  return {
    take: query.limit + 1,
    idFilter: query.cursor ? { lt: query.cursor } : undefined,
  };
}

export function toPage<T extends { id: string }, V>(rows: T[], limit: number, map: (row: T) => V): Page<V> {
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  return {
    items: visible.map(map),
    nextCursor: hasMore && last ? last.id : null,
  };
}
