import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import { pagedQuery } from './paged';
import type { AdminDocumentType, AttributeDefinition } from './types/admin.types';
import type { DocumentRequest, DocumentView } from './types/document.types';
import type { DocumentExtraction, OpsCase, OpsCaseDetail, OpsSubmission, OpsSubmissionDetail } from './types/ops.types';

export type OpsCaseFilter = { status?: string; category?: string; channel?: string; q?: string };

export type OpsSubmissionFilter = { status?: string; lenderId?: string; applicationId?: string };

export const opsCaseKeys = {
  all: ['ops-cases'] as const,
  list: (filter: OpsCaseFilter) => [...opsCaseKeys.all, 'list', filter] as const,
  detail: (id: string) => [...opsCaseKeys.all, 'detail', id] as const,
  submissions: (filter: OpsSubmissionFilter) => [...opsCaseKeys.all, 'submissions', filter] as const,
  submission: (id: string) => [...opsCaseKeys.all, 'submission', id] as const,
  document: (id: string) => [...opsCaseKeys.all, 'document', id] as const,
  extractions: (id: string) => [...opsCaseKeys.all, 'document', id, 'extractions'] as const,
};

const catalogKeys = { documentTypes: ['admin', 'document-types'] as const, attributes: ['admin', 'attributes'] as const };

export const opsCasesQuery = (filter: OpsCaseFilter) => pagedQuery<OpsCase>(opsCaseKeys.list(filter), 'GET /ops/cases', filter);

export const opsCaseQuery = (id: string) => queryOptions({ queryKey: opsCaseKeys.detail(id), queryFn: () => apiRequest<OpsCaseDetail>('GET /ops/cases/:id', { params: { id } }) });

export const assignCase = (id: string, assigneeUserId: string | null) => apiRequest<OpsCase>('POST /ops/cases/:id/assign', { params: { id }, body: { assigneeUserId } });

export const verifyCaseFact = (id: string, attribute: string, body: { value: unknown; reason: string }) => apiRequest<unknown>('POST /ops/cases/:id/facts/:attribute/verify', { params: { id, attribute }, body });

export const requestCaseDocuments = (id: string, body: { documentTypes: string[]; note?: string; dueInDays?: number }) => apiRequest<DocumentRequest>('POST /ops/cases/:id/document-requests', { params: { id }, body, idempotent: true });

export const recomputeAssessment = (scoreResultId: string, mode: string) => apiRequest<unknown>('POST /ops/assessments/:id/recompute', { params: { id: scoreResultId }, body: { mode } });

export const opsSubmissionsQuery = (filter: OpsSubmissionFilter) => pagedQuery<OpsSubmission>(opsCaseKeys.submissions(filter), 'GET /ops/submissions', filter);

export const opsSubmissionQuery = (id: string) => queryOptions({ queryKey: opsCaseKeys.submission(id), queryFn: () => apiRequest<OpsSubmissionDetail>('GET /ops/submissions/:id', { params: { id } }) });

export const approveSubmission = (id: string, body: { note?: string; expectedVersion: number }) => apiRequest<OpsSubmission>('POST /ops/submissions/:id/approve', { params: { id }, body });

export const recordSubmissionEvent = (id: string, body: Record<string, unknown>) => apiRequest<OpsSubmission>('POST /ops/submissions/:id/events', { params: { id }, body, idempotent: true });

export const documentQuery = (id: string) => queryOptions({ queryKey: opsCaseKeys.document(id), queryFn: () => apiRequest<DocumentView>('GET /documents/:id', { params: { id } }) });

export const extractionsQuery = (id: string) => queryOptions({ queryKey: opsCaseKeys.extractions(id), queryFn: () => apiRequest<{ items: DocumentExtraction[] }>('GET /ops/documents/:id/extractions', { params: { id } }) });

export const reviewDocument = (id: string, body: { outcome: 'verified' | 'rejected'; fields?: Array<{ attributeKey: string; value: unknown }>; rejectReason?: string; note?: string }) =>
  apiRequest<DocumentView>('POST /ops/documents/:id/review', { params: { id }, body });

export const documentTypesQuery = () => queryOptions({ queryKey: catalogKeys.documentTypes, queryFn: () => apiRequest<{ items: AdminDocumentType[] }>('GET /admin/document-types'), staleTime: Infinity });

export const attributesQuery = () => queryOptions({ queryKey: catalogKeys.attributes, queryFn: () => apiRequest<{ items: AttributeDefinition[] }>('GET /admin/attributes'), staleTime: Infinity });
