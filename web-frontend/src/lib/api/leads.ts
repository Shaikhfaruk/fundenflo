import { infiniteQueryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { Page } from './types/common.types';
import type { OpsLead, OpsLeadFilter } from './types/lead.types';

export const PAGE_SIZE = 25;

export const opsLeadKeys = {
  all: ['ops-leads'] as const,
  list: (filter: OpsLeadFilter) => [...opsLeadKeys.all, 'list', filter] as const,
};

export const opsLeadsQuery = (filter: OpsLeadFilter) =>
  infiniteQueryOptions({
    queryKey: opsLeadKeys.list(filter),
    queryFn: ({ pageParam }) => apiRequest<Page<OpsLead>>('GET /ops/leads', { query: { ...filter, cursor: pageParam ?? undefined, limit: PAGE_SIZE } }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
