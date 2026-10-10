import { apiRequest } from './client';

type SyncChange = { type: string; id: string; version: number; updatedAt: string };

export type SyncPage = { items: SyncChange[]; nextCursor: string | null; hasMore: boolean };

export const syncChanges = (query: { since?: string; updatedSince?: string; limit: number }) => apiRequest<SyncPage>('GET /sync/changes', { query });

