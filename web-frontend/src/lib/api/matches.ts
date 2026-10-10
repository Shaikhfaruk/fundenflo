import { queryOptions } from '@tanstack/react-query';

import { ApiError } from './api-error';
import { applicationKeys } from './applications';
import { apiRequest } from './client';
import type { MatchRun } from './types/match.types';

export const matchKeys = { latest: (applicationId: string) => [...applicationKeys.detail(applicationId), 'matches'] as const };

export const latestMatchesQuery = (applicationId: string) =>
  queryOptions({
    queryKey: matchKeys.latest(applicationId),
    queryFn: async () => {
      try {
        return await apiRequest<MatchRun>('GET /applications/:id/matches/latest', { params: { id: applicationId } });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

export const runMatches = (applicationId: string) => apiRequest<MatchRun>('POST /applications/:id/matches', { params: { id: applicationId } });
