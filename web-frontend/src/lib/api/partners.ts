import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { Application } from './types/application.types';
import type { ConsentItemInput, ConsentOtpChallenge } from './types/consent.types';
import { pagedQuery } from './paged';
import type { CapacityInput, CommissionStatement, CommissionSummary, LedgerEntry, PartnerBorrower, PartnerBorrowerInput, PartnerCapacity, PartnerDashboard, PartnerKycInput, PartnerProfile, PartnerSignupInput, PartnerTeam, ReferralCode, ServiceArea, ServiceAreaInput } from './types/partner.types';

export const partnerKeys = {
  all: ['partner'] as const,
  dashboard: () => [...partnerKeys.all, 'dashboard'] as const,
  profile: () => [...partnerKeys.all, 'profile'] as const,
  capacity: () => [...partnerKeys.all, 'capacity'] as const,
  serviceAreas: () => [...partnerKeys.all, 'service-areas'] as const,
  team: () => [...partnerKeys.all, 'team'] as const,
  referralCodes: () => [...partnerKeys.all, 'referral-codes'] as const,
  commissions: () => [...partnerKeys.all, 'commissions'] as const,
  ledger: () => [...partnerKeys.commissions(), 'ledger'] as const,
  statement: (month: string) => [...partnerKeys.commissions(), 'statement', month] as const,
  clients: () => [...partnerKeys.all, 'clients'] as const,
};

export const partnerDashboardQuery = () => queryOptions({ queryKey: partnerKeys.dashboard(), queryFn: () => apiRequest<PartnerDashboard>('GET /partner/dashboard') });

export const partnerProfileQuery = () => queryOptions({ queryKey: partnerKeys.profile(), queryFn: () => apiRequest<PartnerProfile>('GET /partner/profile') });

export const partnerSignup = (body: PartnerSignupInput) => apiRequest<PartnerProfile>('POST /partner/signup', { body, idempotent: true });

export const sendBorrowerConsent = (id: string) => apiRequest<ConsentOtpChallenge>('POST /partner/applications/:id/borrower-consent/send', { params: { id } });

export const confirmBorrowerConsent = (id: string, body: { challengeId: string; code: string; items: ConsentItemInput[] }) =>
  apiRequest<{ missingRequired: string[]; application: Application }>('POST /partner/applications/:id/borrower-consent/verify', { params: { id }, body });

export const updatePartnerProfile = (body: PartnerKycInput, version: number) => apiRequest<PartnerProfile>('PATCH /partner/profile', { body, version });

export const partnerCapacityQuery = () => queryOptions({ queryKey: partnerKeys.capacity(), queryFn: () => apiRequest<PartnerCapacity>('GET /partner/capacity') });

export const updatePartnerCapacity = (body: CapacityInput, version: number) => apiRequest<PartnerCapacity>('PUT /partner/capacity', { body, version });

export const serviceAreasQuery = () => queryOptions({ queryKey: partnerKeys.serviceAreas(), queryFn: () => apiRequest<{ items: ServiceArea[] }>('GET /partner/service-areas') });

export const replaceServiceAreas = (areas: ServiceAreaInput[]) => apiRequest<{ items: ServiceArea[] }>('PUT /partner/service-areas', { body: { areas } });

export const partnerTeamQuery = () => queryOptions({ queryKey: partnerKeys.team(), queryFn: () => apiRequest<PartnerTeam>('GET /partner/members') });

export const invitePartnerMember = (body: { mobile: string; countryCode?: string }) => apiRequest<unknown>('POST /partner/members', { body, idempotent: true });

export const updatePartnerMember = (id: string, status: string) => apiRequest<unknown>('PATCH /partner/members/:id', { params: { id }, body: { status } });

export const referralCodesQuery = () => queryOptions({ queryKey: partnerKeys.referralCodes(), queryFn: () => apiRequest<{ available: boolean; items: ReferralCode[] }>('GET /partner/referral-codes') });

export const commissionSummaryQuery = () => queryOptions({ queryKey: partnerKeys.commissions(), queryFn: () => apiRequest<CommissionSummary>('GET /partner/commissions/summary') });

export const commissionLedgerQuery = () => pagedQuery<LedgerEntry>(partnerKeys.ledger(), 'GET /partner/commissions/ledger');

export const commissionStatementQuery = (month: string) => queryOptions({ queryKey: partnerKeys.statement(month), queryFn: () => apiRequest<CommissionStatement>('GET /partner/commissions/statement', { query: { month } }) });

export const registerPartnerBorrower = (body: PartnerBorrowerInput) => apiRequest<PartnerBorrower>('POST /partner/borrowers', { body, idempotent: true });

export const createPartnerApplication = (body: { borrowerProfileId: string; category?: string }) => apiRequest<Application>('POST /partner/applications', { body, idempotent: true });
