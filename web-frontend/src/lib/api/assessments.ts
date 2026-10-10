import { queryOptions } from '@tanstack/react-query';

import { ANALYSIS_POLL_MS, OPEN_ANALYSIS_STATUSES } from '@/lib/constants/assessment.constants';
import { ApiError } from './api-error';
import { applicationKeys } from './applications';
import { apiRequest } from './client';
import type { Analysis, Assessment } from './types/assessment.types';

const assessmentKeys = {
  assessment: (applicationId: string) => [...applicationKeys.detail(applicationId), 'assessment'] as const,
  analysis: (applicationId: string, analysisId: string) => [...applicationKeys.detail(applicationId), 'analysis', analysisId] as const,
};

export const requestAnalysis = (applicationId: string) => apiRequest<Analysis>('POST /applications/:id/analyses', { params: { id: applicationId }, body: {} });

export const analysisQuery = (applicationId: string, analysisId: string) =>
  queryOptions({
    queryKey: assessmentKeys.analysis(applicationId, analysisId),
    queryFn: () => apiRequest<Analysis>('GET /analyses/:id', { params: { id: analysisId } }),
    refetchInterval: (query) => (query.state.data && !OPEN_ANALYSIS_STATUSES.includes(query.state.data.status) ? false : ANALYSIS_POLL_MS),
  });

export const assessmentQuery = (applicationId: string) =>
  queryOptions({
    queryKey: assessmentKeys.assessment(applicationId),
    queryFn: async () => {
      try {
        return await apiRequest<Assessment>('GET /applications/:id/assessment', { params: { id: applicationId } });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
