import { queryOptions } from '@tanstack/react-query';

import { applicationKeys } from './applications';
import { apiRequest } from './client';
import type { Page } from './types/common.types';
import type { DocumentChecklist, DocumentRequest, DocumentView, UploadInput } from './types/document.types';
import { uploadForm } from './upload';

const APPLICATION_DOCUMENTS_LIMIT = 100;

const documentKeys = {
  checklist: (applicationId: string) => [...applicationKeys.detail(applicationId), 'document-checklist'] as const,
  list: (applicationId: string) => [...applicationKeys.detail(applicationId), 'documents'] as const,
  requests: (applicationId: string) => [...applicationKeys.detail(applicationId), 'document-requests'] as const,
};

export const documentChecklistQuery = (applicationId: string) =>
  queryOptions({ queryKey: documentKeys.checklist(applicationId), queryFn: () => apiRequest<DocumentChecklist>('GET /applications/:id/document-checklist', { params: { id: applicationId } }) });

export const applicationDocumentsQuery = (applicationId: string) =>
  queryOptions({ queryKey: documentKeys.list(applicationId), queryFn: () => apiRequest<Page<DocumentView>>('GET /documents', { query: { applicationId, limit: APPLICATION_DOCUMENTS_LIMIT } }) });

export const documentRequestsQuery = (applicationId: string) =>
  queryOptions({ queryKey: documentKeys.requests(applicationId), queryFn: () => apiRequest<{ items: DocumentRequest[] }>('GET /applications/:id/document-requests', { params: { id: applicationId } }) });

export function uploadDocument(input: UploadInput, options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}) {
  const form = new FormData();
  form.append('documentType', input.documentType);
  form.append('applicationId', input.applicationId);
  if (input.password) form.append('password', input.password);
  form.append('file', input.file, input.file.name);
  return uploadForm<DocumentView>('POST /documents', form, options);
}

export const removeDocument = (id: string) => apiRequest<void>('DELETE /documents/:id', { params: { id } });

export const documentDownloadUrl = (id: string) => apiRequest<{ url: string; expiresAt: string }>('GET /documents/:id/download-url', { params: { id } });
