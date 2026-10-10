import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import { pagedQuery } from './paged';
import type { AttributionDispute, ConsistencySignal, DataRequest, FraudReview, RiskSignal } from './types/ops.types';

export const opsRiskKeys = {
  all: ['ops-risk'] as const,
  consistency: (status?: string) => [...opsRiskKeys.all, 'consistency', status ?? 'all'] as const,
  signals: (filter: Record<string, string | undefined>) => [...opsRiskKeys.all, 'signals', filter] as const,
  reviews: (status?: string) => [...opsRiskKeys.all, 'reviews', status ?? 'all'] as const,
  review: (id: string) => [...opsRiskKeys.all, 'review', id] as const,
  dataRequests: (filter: Record<string, string | undefined>) => [...opsRiskKeys.all, 'data-requests', filter] as const,
  dataRequest: (id: string) => [...opsRiskKeys.all, 'data-request', id] as const,
  disputes: (status?: string) => [...opsRiskKeys.all, 'disputes', status ?? 'all'] as const,
};

export const consistencySignalsQuery = (status?: string) => pagedQuery<ConsistencySignal>(opsRiskKeys.consistency(status), 'GET /ops/consistency-signals', { status });

export const resolveConsistencySignal = (id: string, body: { status: string; note: string }) => apiRequest<ConsistencySignal>('POST /ops/consistency-signals/:id/resolve', { params: { id }, body });

export const riskSignalsQuery = (filter: { kind?: string; severity?: string; status?: string }) => pagedQuery<RiskSignal>(opsRiskKeys.signals(filter), 'GET /ops/risk-signals', filter);

export const fraudReviewsQuery = (status?: string) => pagedQuery<FraudReview>(opsRiskKeys.reviews(status), 'GET /ops/fraud-reviews', { status });

export const fraudReviewQuery = (id: string) => queryOptions({ queryKey: opsRiskKeys.review(id), queryFn: () => apiRequest<FraudReview>('GET /ops/fraud-reviews/:id', { params: { id } }) });

export const decideFraudReview = (id: string, body: { decision: string; note: string; expectedVersion: number }) => apiRequest<FraudReview>('POST /ops/fraud-reviews/:id/decision', { params: { id }, body });

export const dataRequestsQuery = (filter: { status?: string; kind?: string }) => pagedQuery<DataRequest>(opsRiskKeys.dataRequests(filter), 'GET /ops/data-requests', filter);

export const dataRequestQuery = (id: string) => queryOptions({ queryKey: opsRiskKeys.dataRequest(id), queryFn: () => apiRequest<DataRequest>('GET /ops/data-requests/:id', { params: { id } }) });

export const completeDataRequest = (id: string, response: string) => apiRequest<DataRequest>('POST /ops/data-requests/:id/complete', { params: { id }, body: { response } });

export const rejectDataRequest = (id: string, reason: string) => apiRequest<DataRequest>('POST /ops/data-requests/:id/reject', { params: { id }, body: { reason } });

export const disputesQuery = (status?: string) => pagedQuery<AttributionDispute>(opsRiskKeys.disputes(status), 'GET /ops/attribution-disputes', { status });

export const resolveDispute = (id: string, body: { outcome: string; note: string; expectedVersion: number }) => apiRequest<AttributionDispute>('POST /ops/attribution-disputes/:id/resolve', { params: { id }, body });
