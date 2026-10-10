import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import { pagedQuery } from './paged';
import type { ConsentItemInput, ConsentState } from './types/consent.types';
import type { MatchReview, PartyAnswer, PartyConsentRecord, PartyFact, PartyMerge } from './types/ops.types';

export const opsPartyKeys = {
  all: ['ops-parties'] as const,
  facts: (partyId: string) => [...opsPartyKeys.all, partyId, 'facts'] as const,
  factHistory: (partyId: string) => [...opsPartyKeys.all, partyId, 'facts', 'history'] as const,
  consents: (partyId: string) => [...opsPartyKeys.all, partyId, 'consents'] as const,
  consentHistory: (partyId: string) => [...opsPartyKeys.all, partyId, 'consents', 'history'] as const,
  answers: (partyId: string) => [...opsPartyKeys.all, partyId, 'answers'] as const,
  reviews: (status: string) => [...opsPartyKeys.all, 'match-reviews', status] as const,
  review: (id: string) => [...opsPartyKeys.all, 'match-review', id] as const,
  merges: () => [...opsPartyKeys.all, 'merges'] as const,
};

export const partyFactsQuery = (partyId: string) => queryOptions({ queryKey: opsPartyKeys.facts(partyId), queryFn: () => apiRequest<{ items: PartyFact[] }>('GET /ops/parties/:partyId/facts', { params: { partyId } }) });

export const partyFactHistoryQuery = (partyId: string) => pagedQuery<PartyFact>(opsPartyKeys.factHistory(partyId), 'GET /ops/parties/:partyId/facts/history', {}, { partyId });

export const recordPartyFacts = (partyId: string, body: { facts: Array<{ attributeKey: string; value: unknown }>; note: string }) => apiRequest<unknown>('POST /ops/parties/:partyId/facts', { params: { partyId }, body });

export const partyConsentsQuery = (partyId: string) => queryOptions({ queryKey: opsPartyKeys.consents(partyId), queryFn: () => apiRequest<{ items: ConsentState[] }>('GET /ops/parties/:partyId/consents', { params: { partyId } }) });

export const partyConsentHistoryQuery = (partyId: string) => pagedQuery<PartyConsentRecord>(opsPartyKeys.consentHistory(partyId), 'GET /ops/parties/:partyId/consents/history', {}, { partyId });

export const recordPartyConsents = (partyId: string, body: { channel: string; evidence: string; items: ConsentItemInput[] }) => apiRequest<unknown>('POST /ops/parties/:partyId/consents', { params: { partyId }, body, idempotent: true });

export const partyAnswersQuery = (partyId: string) => pagedQuery<PartyAnswer>(opsPartyKeys.answers(partyId), 'GET /ops/parties/:partyId/answers', {}, { partyId });

export const recordPartyAnswers = (partyId: string, body: { stage: string; segment?: string; answers: Array<{ questionKey: string; value: unknown }> }) => apiRequest<unknown>('POST /ops/parties/:partyId/answers', { params: { partyId }, body });

export const matchReviewsQuery = (status: string) => pagedQuery<MatchReview>(opsPartyKeys.reviews(status), 'GET /ops/party-match-reviews', { status });

export const matchReviewQuery = (id: string) => queryOptions({ queryKey: opsPartyKeys.review(id), queryFn: () => apiRequest<MatchReview>('GET /ops/party-match-reviews/:id', { params: { id } }) });

export const resolveMatchReview = (id: string, body: { decision: string; survivorPartyId?: string; mergedPartyId?: string; note: string }) => apiRequest<MatchReview>('POST /ops/party-match-reviews/:id/resolve', { params: { id }, body });

export const mergeParties = (body: { survivorPartyId: string; mergedPartyId: string; reason: string }) => apiRequest<PartyMerge>('POST /ops/parties/merge', { body, idempotent: true });

export const partyMergesQuery = () => pagedQuery<PartyMerge>(opsPartyKeys.merges(), 'GET /ops/party-merges');

export const revertMerge = (id: string, reason: string) => apiRequest<PartyMerge>('POST /ops/party-merges/:id/revert', { params: { id }, body: { reason } });
