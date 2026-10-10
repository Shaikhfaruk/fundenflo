import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import { pagedQuery } from './paged';
import type { LenderProducts } from './types/lender.types';
import type { LenderSubmission, SubmissionFile } from './types/submission.types';

export const lenderKeys = {
  all: ['lender'] as const,
  submissions: (status?: string) => [...lenderKeys.all, 'submissions', status ?? 'all'] as const,
};

export const lenderSubmissionsQuery = (status?: string) => pagedQuery<LenderSubmission>(lenderKeys.submissions(status), 'GET /lender/submissions', { status });

const lenderDetailKeys = {
  submission: (id: string) => [...lenderKeys.all, 'submission', id] as const,
  products: () => [...lenderKeys.all, 'products'] as const,
};

export const lenderSubmissionQuery = (id: string) => queryOptions({ queryKey: lenderDetailKeys.submission(id), queryFn: () => apiRequest<SubmissionFile>('GET /lender/submissions/:id', { params: { id } }) });

export const recordLenderEvent = (id: string, body: Record<string, unknown>) => apiRequest<LenderSubmission>('POST /lender/submissions/:id/events', { params: { id }, body, idempotent: true });

export const requestLenderDocuments = (id: string, body: { documentTypes: string[]; note?: string; dueInDays?: number }) => apiRequest<unknown>('POST /lender/submissions/:id/document-requests', { params: { id }, body, idempotent: true });

export const lenderDocumentUrl = (id: string, documentId: string) => apiRequest<{ url: string; expiresAt: string }>('GET /lender/submissions/:id/documents/:documentId/download-url', { params: { id, documentId } });

export const lenderProductsQuery = () => queryOptions({ queryKey: lenderDetailKeys.products(), queryFn: () => apiRequest<LenderProducts>('GET /lender/products') });

export const proposeProductChange = (id: string, body: { content: unknown; reason: string }) => apiRequest<unknown>('POST /lender/products/:id/change-requests', { params: { id }, body });
