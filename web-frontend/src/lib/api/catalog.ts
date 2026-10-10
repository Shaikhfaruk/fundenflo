import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { City, GeoState, LoanCategory, PincodePlace, Segment } from './types/catalog.types';
import type { DocumentChecklist } from './types/document.types';

const CATALOG_STALE_TIME_MS = 10 * 60_000;

const catalogKeys = {
  all: ['catalog'] as const,
  segments: () => [...catalogKeys.all, 'segments'] as const,
  categories: (filter: { segment?: string; subSegment?: string; pincode?: string }) => [...catalogKeys.all, 'categories', filter] as const,
  states: () => [...catalogKeys.all, 'states'] as const,
  cities: (q: string) => [...catalogKeys.all, 'cities', q] as const,
  pincode: (pincode: string) => [...catalogKeys.all, 'pincode', pincode] as const,
};

export const segmentsQuery = () => queryOptions({ queryKey: catalogKeys.segments(), queryFn: () => apiRequest<{ items: Segment[] }>('GET /catalog/segments'), staleTime: CATALOG_STALE_TIME_MS });

export const categoriesQuery = (filter: { segment?: string; subSegment?: string; pincode?: string } = {}) =>
  queryOptions({ queryKey: catalogKeys.categories(filter), queryFn: () => apiRequest<{ items: LoanCategory[] }>('GET /catalog/loan-categories', { query: filter }), staleTime: CATALOG_STALE_TIME_MS });

export const statesQuery = () => queryOptions({ queryKey: catalogKeys.states(), queryFn: () => apiRequest<{ items: GeoState[] }>('GET /catalog/geo/states'), staleTime: CATALOG_STALE_TIME_MS });

export const citySearchQuery = (q: string) => queryOptions({ queryKey: catalogKeys.cities(q), queryFn: () => apiRequest<{ items: City[] }>('GET /catalog/geo/cities', { query: { q } }), staleTime: CATALOG_STALE_TIME_MS });

export const pincodeQuery = (pincode: string) => queryOptions({ queryKey: catalogKeys.pincode(pincode), queryFn: () => apiRequest<PincodePlace>('GET /catalog/geo/pincodes/:pincode', { params: { pincode } }), staleTime: CATALOG_STALE_TIME_MS, retry: false });

export const catalogChecklistQuery = (stage: string, segment: string) =>
  queryOptions({ queryKey: [...catalogKeys.all, 'document-checklist', stage, segment] as const, queryFn: () => apiRequest<DocumentChecklist>('GET /catalog/document-checklist', { query: { stage, segment } }), staleTime: CATALOG_STALE_TIME_MS });
