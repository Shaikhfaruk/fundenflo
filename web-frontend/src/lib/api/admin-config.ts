import { queryOptions } from '@tanstack/react-query';

import type { BackendRoute } from './backend-routes';
import { apiRequest } from './client';
import { pagedQuery } from './paged';
import type { ChangeRequest, ConfigDocument, ConfigVersion, LocalisedText } from './types/admin-config.types';
import type { ConfigResource } from '@/lib/constants/admin.constants';

type ConfigRoutes = { list: BackendRoute; create: BackendRoute; get: BackendRoute; update: BackendRoute; createVersion: BackendRoute; getVersion: BackendRoute; updateDraft: BackendRoute; submit: BackendRoute; publish: BackendRoute; retire: BackendRoute };

const CONFIG_ROUTES: Record<ConfigResource, ConfigRoutes> = {
  question_set: {
    list: 'GET /admin/question-sets',
    create: 'POST /admin/question-sets',
    get: 'GET /admin/question-sets/:id',
    update: 'PATCH /admin/question-sets/:id',
    createVersion: 'POST /admin/question-sets/:id/versions',
    getVersion: 'GET /admin/question-sets/:id/versions/:number',
    updateDraft: 'PATCH /admin/question-sets/:id/versions/:number',
    submit: 'POST /admin/question-sets/:id/versions/:number/submit',
    publish: 'POST /admin/question-sets/:id/versions/:number/publish',
    retire: 'POST /admin/question-sets/:id/versions/:number/retire',
  },
  routing_rule: {
    list: 'GET /admin/routing-rules',
    create: 'POST /admin/routing-rules',
    get: 'GET /admin/routing-rules/:id',
    update: 'PATCH /admin/routing-rules/:id',
    createVersion: 'POST /admin/routing-rules/:id/versions',
    getVersion: 'GET /admin/routing-rules/:id/versions/:number',
    updateDraft: 'PATCH /admin/routing-rules/:id/versions/:number',
    submit: 'POST /admin/routing-rules/:id/versions/:number/submit',
    publish: 'POST /admin/routing-rules/:id/versions/:number/publish',
    retire: 'POST /admin/routing-rules/:id/versions/:number/retire',
  },
  consent_template: {
    list: 'GET /admin/consent-templates',
    create: 'POST /admin/consent-templates',
    get: 'GET /admin/consent-templates/:id',
    update: 'PATCH /admin/consent-templates/:id',
    createVersion: 'POST /admin/consent-templates/:id/versions',
    getVersion: 'GET /admin/consent-templates/:id/versions/:number',
    updateDraft: 'PATCH /admin/consent-templates/:id/versions/:number',
    submit: 'POST /admin/consent-templates/:id/versions/:number/submit',
    publish: 'POST /admin/consent-templates/:id/versions/:number/publish',
    retire: 'POST /admin/consent-templates/:id/versions/:number/retire',
  },
  document_requirement: {
    list: 'GET /admin/document-requirements',
    create: 'POST /admin/document-requirements',
    get: 'GET /admin/document-requirements/:id',
    update: 'PATCH /admin/document-requirements/:id',
    createVersion: 'POST /admin/document-requirements/:id/versions',
    getVersion: 'GET /admin/document-requirements/:id/versions/:number',
    updateDraft: 'PATCH /admin/document-requirements/:id/versions/:number',
    submit: 'POST /admin/document-requirements/:id/versions/:number/submit',
    publish: 'POST /admin/document-requirements/:id/versions/:number/publish',
    retire: 'POST /admin/document-requirements/:id/versions/:number/retire',
  },
  lender_product: {
    list: 'GET /admin/lender-products',
    create: 'POST /admin/lender-products',
    get: 'GET /admin/lender-products/:id',
    update: 'PATCH /admin/lender-products/:id',
    createVersion: 'POST /admin/lender-products/:id/versions',
    getVersion: 'GET /admin/lender-products/:id/versions/:number',
    updateDraft: 'PATCH /admin/lender-products/:id/versions/:number',
    submit: 'POST /admin/lender-products/:id/versions/:number/submit',
    publish: 'POST /admin/lender-products/:id/versions/:number/publish',
    retire: 'POST /admin/lender-products/:id/versions/:number/retire',
  },
  scoring_model: {
    list: 'GET /admin/scoring-models',
    create: 'POST /admin/scoring-models',
    get: 'GET /admin/scoring-models/:id',
    update: 'PATCH /admin/scoring-models/:id',
    createVersion: 'POST /admin/scoring-models/:id/versions',
    getVersion: 'GET /admin/scoring-models/:id/versions/:number',
    updateDraft: 'PATCH /admin/scoring-models/:id/versions/:number',
    submit: 'POST /admin/scoring-models/:id/versions/:number/submit',
    publish: 'POST /admin/scoring-models/:id/versions/:number/publish',
    retire: 'POST /admin/scoring-models/:id/versions/:number/retire',
  },
  improvement_rule: {
    list: 'GET /admin/improvement-rules',
    create: 'POST /admin/improvement-rules',
    get: 'GET /admin/improvement-rules/:id',
    update: 'PATCH /admin/improvement-rules/:id',
    createVersion: 'POST /admin/improvement-rules/:id/versions',
    getVersion: 'GET /admin/improvement-rules/:id/versions/:number',
    updateDraft: 'PATCH /admin/improvement-rules/:id/versions/:number',
    submit: 'POST /admin/improvement-rules/:id/versions/:number/submit',
    publish: 'POST /admin/improvement-rules/:id/versions/:number/publish',
    retire: 'POST /admin/improvement-rules/:id/versions/:number/retire',
  },
  commission_scheme: {
    list: 'GET /admin/commission-schemes',
    create: 'POST /admin/commission-schemes',
    get: 'GET /admin/commission-schemes/:id',
    update: 'PATCH /admin/commission-schemes/:id',
    createVersion: 'POST /admin/commission-schemes/:id/versions',
    getVersion: 'GET /admin/commission-schemes/:id/versions/:number',
    updateDraft: 'PATCH /admin/commission-schemes/:id/versions/:number',
    submit: 'POST /admin/commission-schemes/:id/versions/:number/submit',
    publish: 'POST /admin/commission-schemes/:id/versions/:number/publish',
    retire: 'POST /admin/commission-schemes/:id/versions/:number/retire',
  },
};

export const adminConfigKeys = {
  all: ['admin', 'config'] as const,
  documents: (resource: ConfigResource, status: string | undefined) => [...adminConfigKeys.all, resource, 'list', status ?? 'any'] as const,
  document: (resource: ConfigResource, id: string) => [...adminConfigKeys.all, resource, 'detail', id] as const,
  version: (resource: ConfigResource, id: string, number: number) => [...adminConfigKeys.all, resource, 'detail', id, 'version', number] as const,
  changeRequests: (status: string | undefined) => [...adminConfigKeys.all, 'change-requests', status ?? 'any'] as const,
  changeRequest: (id: string) => [...adminConfigKeys.all, 'change-requests', 'detail', id] as const,
};

export const configDocumentsQuery = (resource: ConfigResource, status?: string) => pagedQuery<ConfigDocument>(adminConfigKeys.documents(resource, status), CONFIG_ROUTES[resource].list, { status });

export const configDocumentQuery = (resource: ConfigResource, id: string) => queryOptions({ queryKey: adminConfigKeys.document(resource, id), queryFn: () => apiRequest<ConfigDocument>(CONFIG_ROUTES[resource].get, { params: { id } }) });

export const configVersionQuery = (resource: ConfigResource, id: string, number: number) =>
  queryOptions({ queryKey: adminConfigKeys.version(resource, id, number), queryFn: () => apiRequest<ConfigVersion>(CONFIG_ROUTES[resource].getVersion, { params: { id, number } }) });

export const createConfigDocument = (resource: ConfigResource, body: { key: string; name: LocalisedText; description?: LocalisedText; content: unknown; notes?: string }) => apiRequest<ConfigDocument>(CONFIG_ROUTES[resource].create, { body, idempotent: true });

export const updateConfigDocument = (resource: ConfigResource, id: string, body: { name?: LocalisedText; description?: LocalisedText | null; status?: string }, version: number) => apiRequest<ConfigDocument>(CONFIG_ROUTES[resource].update, { params: { id }, body, version });

export const createConfigVersion = (resource: ConfigResource, id: string, body: { fromNumber?: number; notes?: string }) => apiRequest<ConfigVersion>(CONFIG_ROUTES[resource].createVersion, { params: { id }, body });

export const updateConfigDraft = (resource: ConfigResource, id: string, number: number, body: { content?: unknown; notes?: string | null }, version: number) => apiRequest<ConfigVersion>(CONFIG_ROUTES[resource].updateDraft, { params: { id, number }, body, version });

export const submitConfigVersion = (resource: ConfigResource, id: string, number: number, reason: string, version: number) => apiRequest<ConfigVersion>(CONFIG_ROUTES[resource].submit, { params: { id, number }, body: { reason }, version });

export const publishConfigVersion = (resource: ConfigResource, id: string, number: number, effectiveFrom?: string) => apiRequest<ConfigVersion>(CONFIG_ROUTES[resource].publish, { params: { id, number }, body: effectiveFrom ? { effectiveFrom } : {} });

export const retireConfigVersion = (resource: ConfigResource, id: string, number: number, reason: string) => apiRequest<ConfigVersion>(CONFIG_ROUTES[resource].retire, { params: { id, number }, body: { reason } });

export const simulateLenderProduct = (id: string, number: number, body: unknown) => apiRequest<unknown>('POST /admin/lender-products/:id/versions/:number/simulate', { params: { id, number }, body });

export const previewQuestionSet = (id: string, number: number, body: unknown) => apiRequest<unknown>('POST /admin/question-sets/:id/versions/:number/preview', { params: { id, number }, body });

export const simulateRouting = (body: unknown) => apiRequest<unknown>('POST /admin/routing-rules/simulate', { body });

export const changeRequestsQuery = (status?: string) => pagedQuery<ChangeRequest>(adminConfigKeys.changeRequests(status), 'GET /admin/change-requests', { status });

export const changeRequestQuery = (id: string) => queryOptions({ queryKey: adminConfigKeys.changeRequest(id), queryFn: () => apiRequest<ChangeRequest>('GET /admin/change-requests/:id', { params: { id } }) });

export const approveChangeRequest = (id: string, note?: string) => apiRequest<ChangeRequest>('POST /admin/change-requests/:id/approve', { params: { id }, body: note ? { note } : {} });

export const rejectChangeRequest = (id: string, note: string) => apiRequest<ChangeRequest>('POST /admin/change-requests/:id/reject', { params: { id }, body: { note } });
