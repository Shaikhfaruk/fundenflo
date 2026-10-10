import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';

export const DataRequestKind = { Access: 'access', Correction: 'correction', Erasure: 'erasure' } as const;

export type DataRequestKind = (typeof DataRequestKind)[keyof typeof DataRequestKind];

export type DataRequest = {
  id: string;
  ref: string;
  kind: DataRequestKind;
  status: string;
  details: string | null;
  dueAt: string;
  response: string | null;
  rejectedReason: string | null;
  exportReady: boolean;
  exportExpiresAt: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
};

export const privacyKeys = { mine: ['data-requests', 'mine'] as const };

export const myDataRequestsQuery = () => queryOptions({ queryKey: privacyKeys.mine, queryFn: () => apiRequest<{ items: DataRequest[] }>('GET /me/data-requests') });

export const createDataRequest = (body: { kind: DataRequestKind; details?: string }) => apiRequest<DataRequest>('POST /me/data-requests', { body });

export const dataExportUrl = (id: string) => apiRequest<{ url: string; expiresAt: string }>('GET /me/data-requests/:id/export-url', { params: { id } });
