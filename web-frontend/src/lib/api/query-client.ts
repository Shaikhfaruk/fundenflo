import { MutationCache, QueryClient } from '@tanstack/react-query';

import { ErrorCode } from '@/lib/constants/errors.constants';
import { ApiError } from './api-error';
import { reportMutationError } from './mutation-errors';

const QUERY_STALE_TIME_MS = 30_000;

const MAX_NETWORK_RETRIES = 2;

type MutationMeta = { handlesError?: boolean };

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: MutationMeta;
  }
}

const retryable = (failureCount: number, error: unknown) => error instanceof ApiError && (error.code === ErrorCode.NetworkError || error.status >= 500) && failureCount < MAX_NETWORK_RETRIES;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: QUERY_STALE_TIME_MS, retry: retryable, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.handlesError) reportMutationError(error);
      },
    }),
  });
}
