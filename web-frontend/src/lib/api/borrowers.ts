import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { BorrowerProfile, BorrowerProfilePatch, PanInput, PanResult } from './types/borrower.types';
import type { Page } from './types/common.types';

export const borrowerKeys = {
  all: ['borrower-profiles'] as const,
  list: () => [...borrowerKeys.all, 'list'] as const,
  detail: (id: string) => [...borrowerKeys.all, 'detail', id] as const,
};

export const borrowerProfilesQuery = () => queryOptions({ queryKey: borrowerKeys.list(), queryFn: () => apiRequest<Page<BorrowerProfile>>('GET /borrower-profiles') });

export const borrowerProfileQuery = (id: string) => queryOptions({ queryKey: borrowerKeys.detail(id), queryFn: () => apiRequest<BorrowerProfile>('GET /borrower-profiles/:id', { params: { id } }) });

export const updateBorrowerProfile = (id: string, body: BorrowerProfilePatch, version: number) => apiRequest<BorrowerProfile>('PATCH /borrower-profiles/:id', { params: { id }, body, version });

export const verifyPan = (id: string, body: PanInput) => apiRequest<PanResult>('POST /borrower-profiles/:id/kyc/pan', { params: { id }, body });
