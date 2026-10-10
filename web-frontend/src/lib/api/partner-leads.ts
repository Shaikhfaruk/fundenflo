import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import { pagedQuery } from './paged';
import { partnerKeys } from './partners';
import type { Application } from './types/application.types';
import type { FollowUp, LeadActivity, LeadContact, OfflineConversion } from './types/lead.types';
import type { OfflineConversionInput, PartnerLead, PartnerLeadDetail, PartnerLeadPatch, ReferLeadInput, ReferLeadResult } from './types/partner-lead.types';
import type { Referral } from './types/partner.types';

export const partnerLeadKeys = {
  all: [...partnerKeys.all, 'leads'] as const,
  inbox: (view: string) => [...partnerLeadKeys.all, 'inbox', view] as const,
  detail: (id: string) => [...partnerLeadKeys.all, 'detail', id] as const,
  activities: (id: string) => [...partnerLeadKeys.all, 'detail', id, 'activities'] as const,
  followUps: (filter: { status: string; assignee: string }) => [...partnerLeadKeys.all, 'follow-ups', filter] as const,
  referrals: () => [...partnerLeadKeys.all, 'referrals'] as const,
};

type Reasoned = { reason: string; note?: string };

export const partnerInboxQuery = (view: string) => pagedQuery<PartnerLead>(partnerLeadKeys.inbox(view), 'GET /partner/leads', { view });

export const partnerLeadQuery = (id: string) => queryOptions({ queryKey: partnerLeadKeys.detail(id), queryFn: () => apiRequest<PartnerLeadDetail>('GET /partner/leads/:id', { params: { id } }) });

export const acceptPartnerLead = (id: string) => apiRequest<PartnerLeadDetail>('POST /partner/leads/:id/accept', { params: { id } });

export const declinePartnerLead = (id: string, body: Reasoned) => apiRequest<{ id: string; status: string }>('POST /partner/leads/:id/decline', { params: { id }, body });

export const returnPartnerLead = (id: string, body: Reasoned) => apiRequest<{ id: string; status: string }>('POST /partner/leads/:id/return', { params: { id }, body });

export const losePartnerLead = (id: string, body: Reasoned) => apiRequest<PartnerLeadDetail>('POST /partner/leads/:id/lost', { params: { id }, body });

export const revealPartnerContact = (id: string, reason: string) => apiRequest<{ leadId: string; contacts: LeadContact[] }>('POST /partner/leads/:id/reveal-contact', { params: { id }, body: { reason } });

export const subAssignPartnerLead = (id: string, membershipId: string) => apiRequest<PartnerLeadDetail>('POST /partner/leads/:id/sub-assign', { params: { id }, body: { membershipId } });

export const updatePartnerLead = (id: string, body: PartnerLeadPatch, version: number) => apiRequest<PartnerLeadDetail>('PATCH /partner/leads/:id', { params: { id }, body, version });

export const reportOfflineConversion = (id: string, body: OfflineConversionInput) => apiRequest<OfflineConversion>('POST /partner/leads/:id/offline-conversion', { params: { id }, body, idempotent: true });

export const convertPartnerLead = (id: string, body: { segment?: string; subSegment?: string; businessName?: string; category?: string }) => apiRequest<Application>('POST /partner/leads/:id/convert', { params: { id }, body, idempotent: true });

export const partnerLeadActivitiesQuery = (id: string) => pagedQuery<LeadActivity>(partnerLeadKeys.activities(id), 'GET /partner/leads/:id/activities', {}, { id });

export const logPartnerActivity = (id: string, body: { type: string; outcome?: string; body?: string }) => apiRequest<LeadActivity>('POST /partner/leads/:id/activities', { params: { id }, body, idempotent: true });

export const schedulePartnerFollowUp = (id: string, body: { dueAt: string; note: string }) => apiRequest<FollowUp>('POST /partner/leads/:id/follow-ups', { params: { id }, body, idempotent: true });

export const partnerFollowUpsQuery = (filter: { status: string; assignee: string }) =>
  queryOptions({ queryKey: partnerLeadKeys.followUps(filter), queryFn: () => apiRequest<{ items: FollowUp[] }>('GET /partner/follow-ups', { query: filter }) });

export const updatePartnerFollowUp = (id: string, body: { status?: string; dueAt?: string; outcomeNote?: string }) => apiRequest<FollowUp>('PATCH /partner/follow-ups/:id', { params: { id }, body });

export const referLead = (body: ReferLeadInput) => apiRequest<ReferLeadResult>('POST /partner/leads', { body, idempotent: true });

export const referralsQuery = () => pagedQuery<Referral>(partnerLeadKeys.referrals(), 'GET /partner/referrals');

export const claimAttribution = (body: { mobile: string; countryCode?: string; note: string }) => apiRequest<{ id: string; status: string }>('POST /partner/attribution-disputes', { body, idempotent: true });
