import { pagedQuery } from './paged';
import type { LenderSubmission } from './types/submission.types';

export const lenderKeys = {
  all: ['lender'] as const,
  submissions: (status?: string) => [...lenderKeys.all, 'submissions', status ?? 'all'] as const,
};

export const lenderSubmissionsQuery = (status?: string) => pagedQuery<LenderSubmission>(lenderKeys.submissions(status), 'GET /lender/submissions', { status });
