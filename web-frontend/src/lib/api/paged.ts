import { infiniteQueryOptions, type QueryKey } from '@tanstack/react-query';

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
