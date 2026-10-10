import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { PartnerDashboard, PartnerProfile, PartnerSignupInput } from './types/partner.types';

const partnerKeys = {
  all: ['partner'] as const,
  dashboard: () => [...partnerKeys.all, 'dashboard'] as const,
  profile: () => [...partnerKeys.all, 'profile'] as const,
};

export const partnerDashboardQuery = () => queryOptions({ queryKey: partnerKeys.dashboard(), queryFn: () => apiRequest<PartnerDashboard>('GET /partner/dashboard') });

export const partnerProfileQuery = () => queryOptions({ queryKey: partnerKeys.profile(), queryFn: () => apiRequest<PartnerProfile>('GET /partner/profile') });

export const partnerSignup = (body: PartnerSignupInput) => apiRequest<PartnerProfile>('POST /partner/signup', { body, idempotent: true });
