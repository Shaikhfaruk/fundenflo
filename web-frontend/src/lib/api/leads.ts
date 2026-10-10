import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import { pagedQuery } from './paged';
import type { Page } from './types/common.types';
import type { AdminPartner } from './types/admin.types';
import type { CreateLeadInput, OpsLead, OpsLeadDetail, OpsLeadFilter, OpsLeadPatch } from './types/lead.types';
import type { FollowUp, FunnelReport, LeadActivity, LeadContact, OfflineConversion, PartnerPerformance } from './types/ops.types';

export const opsLeadKeys = {
  all: ['ops-leads'] as const,
  list: (filter: OpsLeadFilter) => [...opsLeadKeys.all, 'list', filter] as const,
  detail: (id: string) => [...opsLeadKeys.all, 'detail', id] as const,
  activities: (id: string) => [...opsLeadKeys.all, 'detail', id, 'activities'] as const,
  followUps: (filter: { status: string; assignee: string }) => [...opsLeadKeys.all, 'follow-ups', filter] as const,
  conversions: (status: string) => [...opsLeadKeys.all, 'conversions', status] as const,
  funnel: (groupBy: string, from?: string, to?: string) => [...opsLeadKeys.all, 'reports', 'funnel', groupBy, from ?? '', to ?? ''] as const,
  performance: (from?: string, to?: string) => [...opsLeadKeys.all, 'reports', 'performance', from ?? '', to ?? ''] as const,
  partners: () => ['admin', 'partners', 'verified'] as const,
};

export const opsLeadsQuery = (filter: OpsLeadFilter) => pagedQuery<OpsLead>(opsLeadKeys.list(filter), 'GET /ops/leads', filter);

export const opsLeadQuery = (id: string) => queryOptions({ queryKey: opsLeadKeys.detail(id), queryFn: () => apiRequest<OpsLeadDetail>('GET /ops/leads/:id', { params: { id } }) });

export const createOpsLead = (body: CreateLeadInput) => apiRequest<OpsLeadDetail>('POST /ops/leads', { body, idempotent: true });

export const updateOpsLead = (id: string, body: OpsLeadPatch, version: number) => apiRequest<OpsLeadDetail>('PATCH /ops/leads/:id', { params: { id }, body, version });

const LEAD_ACTION_ROUTES = {
  qualify: 'POST /ops/leads/:id/qualify',
  disqualify: 'POST /ops/leads/:id/disqualify',
  hold: 'POST /ops/leads/:id/hold',
  reopen: 'POST /ops/leads/:id/reopen',
  recycle: 'POST /ops/leads/:id/recycle',
  lose: 'POST /ops/leads/:id/lose',
} as const;

export type LeadAction = keyof typeof LEAD_ACTION_ROUTES;

export const runLeadAction = (id: string, action: LeadAction, body: { note?: string; reason?: string; holdUntil?: string }) => apiRequest<OpsLeadDetail>(LEAD_ACTION_ROUTES[action], { params: { id }, body });

export const routeLead = (id: string) => apiRequest<unknown>('POST /ops/leads/:id/route', { params: { id } });

export const assignLead = (id: string, organizationId: string, note?: string) => apiRequest<unknown>('POST /ops/leads/:id/assign', { params: { id }, body: { organizationId, note } });

export const revokeAssignment = (assignmentId: string, reason: string) => apiRequest<unknown>('POST /ops/leads/assignments/:assignmentId/revoke', { params: { assignmentId }, body: { reason } });

export const sendLeadConsentRequest = (id: string) => apiRequest<{ id: string; recipient: string; expiresAt: string }>('POST /ops/leads/:id/consent-request', { params: { id }, body: {} });

export const revealLeadContact = (id: string, reason: string) => apiRequest<{ leadId: string; contacts: LeadContact[] }>('POST /ops/leads/:id/reveal-contact', { params: { id }, body: { reason } });

export const bulkRouteLeads = (leadIds: string[]) => apiRequest<unknown>('POST /ops/leads/bulk-route', { body: { leadIds } });

export const bulkAssignLeads = (leadIds: string[], organizationId: string, note?: string) => apiRequest<unknown>('POST /ops/leads/bulk-assign', { body: { leadIds, organizationId, note } });

export const mergeLeads = (survivorLeadId: string, leadIds: string[], note: string) => apiRequest<unknown>('POST /ops/leads/merge', { body: { survivorLeadId, leadIds, note } });

export const leadActivitiesQuery = (id: string) => pagedQuery<LeadActivity>(opsLeadKeys.activities(id), 'GET /ops/leads/:id/activities', {}, { id });

export const logLeadActivity = (id: string, body: { type: string; outcome?: string; body?: string }) => apiRequest<LeadActivity>('POST /ops/leads/:id/activities', { params: { id }, body, idempotent: true });

export const scheduleLeadFollowUp = (id: string, body: { dueAt: string; note: string }) => apiRequest<FollowUp>('POST /ops/leads/:id/follow-ups', { params: { id }, body, idempotent: true });

export const opsFollowUpsQuery = (filter: { status: string; assignee: string }) => queryOptions({ queryKey: opsLeadKeys.followUps(filter), queryFn: () => apiRequest<{ items: FollowUp[] }>('GET /ops/follow-ups', { query: filter }) });

export const updateFollowUp = (id: string, body: { status?: string; dueAt?: string; outcomeNote?: string }) => apiRequest<FollowUp>('PATCH /ops/follow-ups/:id', { params: { id }, body });

export const conversionsQuery = (status: string) => pagedQuery<OfflineConversion>(opsLeadKeys.conversions(status), 'GET /ops/offline-conversions', { status });

export const decideConversion = (id: string, body: { decision: string; note?: string }) => apiRequest<OfflineConversion>('POST /ops/offline-conversions/:id/decide', { params: { id }, body });

export const funnelReportQuery = (groupBy: string, from?: string, to?: string) => queryOptions({ queryKey: opsLeadKeys.funnel(groupBy, from, to), queryFn: () => apiRequest<FunnelReport>('GET /ops/reports/leads/funnel', { query: { groupBy, from, to } }) });

export const partnerPerformanceQuery = (from?: string, to?: string) => queryOptions({ queryKey: opsLeadKeys.performance(from, to), queryFn: () => apiRequest<PartnerPerformance>('GET /ops/reports/partners/performance', { query: { from, to } }) });

export const verifiedPartnersQuery = () => queryOptions({ queryKey: opsLeadKeys.partners(), queryFn: () => apiRequest<Page<AdminPartner>>('GET /admin/partners', { query: { limit: 100 } }), staleTime: 60_000 });
