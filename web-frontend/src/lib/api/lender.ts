import { infiniteQueryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import { PAGE_SIZE } from './leads';
import type { Page } from './types/common.types';
import type { LenderSubmission } from './types/submission.types';

export const lenderKeys = {
  all: ['lender'] as const,
  submissions: (status?: string) => [...lenderKeys.all, 'submissions', status ?? 'all'] as const,
};

export const lenderSubmissionsQuery = (status?: string) =>
  infiniteQueryOptions({
    queryKey: lenderKeys.submissions(status),
    queryFn: ({ pageParam }) => apiRequest<Page<LenderSubmission>>('GET /lender/submissions', { query: { status, cursor: pageParam ?? undefined, limit: PAGE_SIZE } }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
