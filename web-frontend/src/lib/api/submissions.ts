import { queryOptions } from '@tanstack/react-query';

import { applicationKeys } from './applications';
import { apiRequest } from './client';
import type { LenderSubmission, SubmissionDetail } from './types/submission.types';

const submissionKeys = {
  list: (applicationId: string) => [...applicationKeys.detail(applicationId), 'submissions'] as const,
  detail: (applicationId: string, submissionId: string) => [...applicationKeys.detail(applicationId), 'submissions', submissionId] as const,
};

export const submissionsQuery = (applicationId: string) =>
  queryOptions({ queryKey: submissionKeys.list(applicationId), queryFn: () => apiRequest<{ items: LenderSubmission[] }>('GET /applications/:id/submissions', { params: { id: applicationId } }) });

export const submissionQuery = (applicationId: string, submissionId: string) =>
  queryOptions({
    queryKey: submissionKeys.detail(applicationId, submissionId),
    queryFn: () => apiRequest<SubmissionDetail>('GET /applications/:id/submissions/:submissionId', { params: { id: applicationId, submissionId } }),
  });

export const requestSubmission = (applicationId: string, body: { matchResultId: string; shareWithLender?: true }) =>
  apiRequest<LenderSubmission>('POST /applications/:id/submissions', { params: { id: applicationId }, body, idempotent: true });

export const withdrawSubmission = (applicationId: string, submissionId: string, reason: string) =>
  apiRequest<LenderSubmission>('POST /applications/:id/submissions/:submissionId/withdraw', { params: { id: applicationId, submissionId }, body: { reason } });
