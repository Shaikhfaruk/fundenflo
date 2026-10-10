import { queryOptions } from '@tanstack/react-query';

import { ApiError } from './api-error';
import { apiRequest } from './client';
import type { ConsentItemInput, ConsentRecordResult, ConsentState, ConsentTemplate } from './types/consent.types';

export const consentKeys = {
  all: ['consents'] as const,
  mine: () => [...consentKeys.all, 'mine'] as const,
  template: (context: string) => [...consentKeys.all, 'template', context] as const,
};

export const myConsentsQuery = () => queryOptions({ queryKey: consentKeys.mine(), queryFn: () => apiRequest<{ items: ConsentState[] }>('GET /me/consents') });

export const consentTemplateQuery = (context: string) =>
  queryOptions({
    queryKey: consentKeys.template(context),
    queryFn: async () => {
      try {
        return await apiRequest<ConsentTemplate>('GET /catalog/consent-templates', { query: { context } });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

export const giveConsents = (body: { templateVersionId: string; items: ConsentItemInput[]; clientRecordedAt: string; locale?: string }) => apiRequest<ConsentRecordResult>('POST /me/consents', { body });

export const withdrawConsent = (purpose: string, organizationIds?: string[]) => apiRequest<ConsentRecordResult>('POST /me/consents/:purpose/withdraw', { params: { purpose }, body: organizationIds ? { organizationIds } : {} });
