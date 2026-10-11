import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import type { ResourceSpec } from '@/lib/constants/admin-resources.constants';

import type { BackendRoute } from './backend-routes';
import { apiRequest } from './client';
import type { PathParams, QueryValue } from './endpoint';
import { allPages, pagedQuery } from './paged';
import type { AdminUser, AdminUserDetail, AuditEvent, AuditVerification, ImportBatch, ImportFields, ImportRow, Invitation } from './types/admin.types';
import type { Page } from './types/common.types';
import type { PartnerProfile } from './types/partner.types';

export type AdminRecord = Record<string, unknown> & { version?: number };

const PAGE_SIZE = 50;

export const adminKeys = {
  all: ['admin'] as const,
  resource: (key: string) => [...adminKeys.all, 'resource', key] as const,
  resourceList: (key: string, filters: Record<string, QueryValue>) => [...adminKeys.resource(key), 'list', filters] as const,
  resourceItem: (key: string, id: string) => [...adminKeys.resource(key), 'item', id] as const,
  children: (key: string, child: string, id: string) => [...adminKeys.resource(key), 'children', child, id] as const,
  options: (source: string, scope: string) => [...adminKeys.all, 'options', source, scope] as const,
  users: (filter: Record<string, QueryValue>) => [...adminKeys.all, 'users', filter] as const,
  user: (id: string) => [...adminKeys.all, 'users', 'detail', id] as const,
  invitations: (filter: Record<string, QueryValue>) => [...adminKeys.all, 'invitations', filter] as const,
  audit: (filter: Record<string, QueryValue>) => [...adminKeys.all, 'audit', filter] as const,
  imports: (status: string | undefined) => [...adminKeys.all, 'imports', status ?? 'any'] as const,
  importBatch: (id: string) => [...adminKeys.all, 'imports', 'detail', id] as const,
  importRows: (id: string) => [...adminKeys.all, 'imports', 'detail', id, 'rows'] as const,
  importFields: (kind: string) => [...adminKeys.all, 'imports', 'fields', kind] as const,
};

export const adminResourceQuery = (spec: ResourceSpec, filters: Record<string, QueryValue>) =>
  infiniteQueryOptions({
    queryKey: adminKeys.resourceList(spec.key, filters),
    queryFn: ({ pageParam }) => apiRequest<Page<AdminRecord>>(spec.list, { query: { ...filters, [spec.cursorParam ?? 'cursor']: pageParam ?? undefined, limit: PAGE_SIZE } }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

export const adminRecordQuery = (spec: ResourceSpec, id: string) =>
  queryOptions({ queryKey: adminKeys.resourceItem(spec.key, id), queryFn: () => apiRequest<AdminRecord>(spec.get as BackendRoute, { params: { id } }), enabled: Boolean(spec.get) });

export const adminChildrenQuery = (spec: ResourceSpec, child: string, route: BackendRoute, id: string) =>
  queryOptions({ queryKey: adminKeys.children(spec.key, child, id), queryFn: () => apiRequest<{ items: AdminRecord[] }>(route, { params: { id }, query: { limit: PAGE_SIZE } }) });

export const sendAdminRecord = (route: BackendRoute, params: PathParams, body: Record<string, unknown>, version?: number) => apiRequest<AdminRecord>(route, { params, body, version, idempotent: route.startsWith('POST') });

export const removeAdminRecord = (route: BackendRoute, id: string) => apiRequest<unknown>(route, { params: { id } });

export const adminOptionsQuery = (source: string, route: BackendRoute, scope: Record<string, QueryValue>) =>
  queryOptions({ queryKey: adminKeys.options(source, JSON.stringify(scope)), queryFn: () => allPages<AdminRecord>(route, scope), staleTime: 60_000 });

export const adminUsersQuery = (filter: { q?: string; status?: string }) => pagedQuery<AdminUser>(adminKeys.users(filter), 'GET /admin/users', filter);

export const adminUserQuery = (id: string) => queryOptions({ queryKey: adminKeys.user(id), queryFn: () => apiRequest<AdminUserDetail>('GET /admin/users/:id', { params: { id } }) });

export const updateAdminUser = (id: string, status: string, version: number) => apiRequest<AdminUserDetail>('PATCH /admin/users/:id', { params: { id }, body: { status }, version });

export const createMembership = (body: { userId: string; organizationId: string; role: string }) => apiRequest<unknown>('POST /admin/memberships', { body, idempotent: true });

export const updateMembership = (id: string, body: { status?: string; role?: string }) => apiRequest<unknown>('PATCH /admin/memberships/:id', { params: { id }, body });

export const invitationsQuery = (filter: { status?: string; organizationId?: string }) => pagedQuery<Invitation>(adminKeys.invitations(filter), 'GET /admin/invitations', filter);

export const createInvitation = (body: { organizationId: string; role: string; email?: string; mobile?: string; countryCode?: string }) => apiRequest<Invitation & { token?: string }>('POST /admin/invitations', { body, idempotent: true });

export const revokeInvitation = (id: string) => apiRequest<Invitation>('POST /admin/invitations/:id/revoke', { params: { id } });

export const auditEventsQuery = (filter: { action?: string; entityType?: string; entityId?: string; actorUserId?: string; from?: string; to?: string }) => pagedQuery<AuditEvent>(adminKeys.audit(filter), 'GET /admin/audit-events', filter);

export const verifyAuditChain = () => apiRequest<AuditVerification>('GET /admin/audit-events/verify', { query: { limit: 5_000 } });

export const verifyPartner = (id: string, body: { decision: string; note: string }) => apiRequest<unknown>('POST /admin/partners/:id/verify', { params: { id }, body });

export const setPartnerLevel = (id: string, body: { level: string; note: string }) => apiRequest<unknown>('POST /admin/partners/:id/level', { params: { id }, body });

export const suspendPartner = (id: string, note: string) => apiRequest<unknown>('POST /admin/partners/:id/suspend', { params: { id }, body: { note } });

export const reinstatePartner = (id: string, note: string) => apiRequest<unknown>('POST /admin/partners/:id/reinstate', { params: { id }, body: { note } });

export const adminPartnerQuery = (id: string) => queryOptions({ queryKey: [...adminKeys.all, 'partners', 'detail', id], queryFn: () => apiRequest<PartnerProfile>('GET /admin/partners/:id', { params: { id } }) });

export const importsQuery = (status?: string) => pagedQuery<ImportBatch>(adminKeys.imports(status), 'GET /admin/imports', { status });

const IMPORT_POLL_MS = 1_500;

export const importBatchQuery = (id: string, busy: readonly string[]) =>
  queryOptions({ queryKey: adminKeys.importBatch(id), queryFn: () => apiRequest<ImportBatch>('GET /admin/imports/:id', { params: { id } }), refetchInterval: (query) => (busy.includes(query.state.data?.status ?? '') ? IMPORT_POLL_MS : false) });

export const importFieldsQuery = (kind: string) => queryOptions({ queryKey: adminKeys.importFields(kind), queryFn: () => apiRequest<ImportFields>('GET /admin/imports/fields/:kind', { params: { kind } }), staleTime: Infinity });

export const importRowsQuery = (id: string) => pagedQuery<ImportRow>(adminKeys.importRows(id), 'GET /admin/imports/:id/errors', {}, { id });

export const createImport = (body: { kind: string; fileName: string }) => apiRequest<{ batch: ImportBatch; upload: { method: string; url: string; headers: Record<string, string>; expiresAt: string } }>('POST /admin/imports', { body, idempotent: true });

export const inspectImport = (id: string) => apiRequest<ImportBatch>('POST /admin/imports/:id/inspect', { params: { id } });

export const mapImport = (id: string, body: { mapping: Record<string, string>; defaults: unknown }, version: number) => apiRequest<ImportBatch>('PUT /admin/imports/:id/mapping', { params: { id }, body, version });

export const validateImport = (id: string) => apiRequest<ImportBatch>('POST /admin/imports/:id/validate', { params: { id } });

export const commitImport = (id: string) => apiRequest<ImportBatch>('POST /admin/imports/:id/commit', { params: { id } });

export const undoImport = (id: string) => apiRequest<ImportBatch>('POST /admin/imports/:id/undo', { params: { id } });

export const validateCondition = (condition: unknown) => apiRequest<unknown>('POST /admin/conditions/validate', { body: { condition } });

export const evaluateCondition = (body: { condition: unknown; facts?: Record<string, unknown>; partyId?: string }) => apiRequest<unknown>('POST /admin/conditions/evaluate', { body });
