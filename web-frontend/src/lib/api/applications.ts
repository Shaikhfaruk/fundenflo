import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { Application, CreateApplicationInput } from './types/application.types';
import type { Page } from './types/common.types';

export const applicationKeys = {
  all: ['applications'] as const,
  list: (filter: { status?: string }) => [...applicationKeys.all, 'list', filter] as const,
  detail: (id: string) => [...applicationKeys.all, 'detail', id] as const,
};

export const applicationsQuery = (filter: { status?: string } = {}) => queryOptions({ queryKey: applicationKeys.list(filter), queryFn: () => apiRequest<Page<Application>>('GET /applications', { query: filter }) });

export const createApplication = (body: CreateApplicationInput) => apiRequest<Application>('POST /applications', { body, idempotent: true });

export const partyName = (application: Pick<Application, 'party' | 'actingParty'>) => application.party.displayName || application.actingParty.displayName || null;
