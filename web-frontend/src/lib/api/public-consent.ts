import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { ConsentRecordResult, ConsentTemplate } from './types/consent.types';

const publicConsentKeys = { request: (token: string) => ['public-consent', token] as const };

export const consentRequestQuery = (token: string) =>
  queryOptions({
    queryKey: publicConsentKeys.request(token),
    queryFn: () => apiRequest<{ expiresAt: string; template: ConsentTemplate }>('GET /public/consent-requests/:token', { params: { token } }),
    retry: false,
  });

export const answerConsentRequest = (token: string, body: { locale?: string; items: Array<{ purpose: string; granted: boolean }> }) =>
  apiRequest<ConsentRecordResult>('POST /public/consent-requests/:token', { params: { token }, body });
