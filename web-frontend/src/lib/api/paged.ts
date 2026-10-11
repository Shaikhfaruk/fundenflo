import { infiniteQueryOptions, type QueryKey } from '@tanstack/react-query';

import { OPTION_MAX_PAGES, OPTION_PAGE_SIZE } from '@/lib/constants/http.constants';

import type { BackendRoute } from './backend-routes';
import { apiRequest } from './client';
import type { PathParams, QueryValue } from './endpoint';
import type { Page } from './types/common.types';

const PAGE_SIZE = 25;

export const pagedQuery = <T>(queryKey: QueryKey, route: BackendRoute, query: Record<string, QueryValue> = {}, params?: PathParams) =>
  infiniteQueryOptions({
    queryKey,
    queryFn: ({ pageParam }) => apiRequest<Page<T>>(route, { params, query: { ...query, cursor: pageParam ?? undefined, limit: PAGE_SIZE } }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

export async function allPages<T>(route: BackendRoute, query: Record<string, QueryValue> = {}): Promise<Page<T>> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < OPTION_MAX_PAGES; page += 1) {
    const next: Page<T> = await apiRequest<Page<T>>(route, { query: { ...query, cursor: cursor ?? undefined, limit: OPTION_PAGE_SIZE } });
    items.push(...next.items);
    cursor = next.nextCursor;
    if (!cursor) break;
  }
  return { items, nextCursor: cursor };
}
