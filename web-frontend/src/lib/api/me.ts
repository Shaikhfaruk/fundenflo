import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { LoginView, MeView, OtpIssued, SessionView } from './types/auth.types';

export const meKeys = {
  all: ['me'] as const,
  profile: () => [...meKeys.all, 'profile'] as const,
  sessions: () => [...meKeys.all, 'sessions'] as const,
  logins: () => [...meKeys.all, 'logins'] as const,
};

export const meQuery = () => queryOptions({ queryKey: meKeys.profile(), queryFn: () => apiRequest<MeView>('GET /me') });

export type ProfilePatch = { fullName?: string; preferredLanguage?: string | null };

export const updateProfile = (body: ProfilePatch, version?: number) => apiRequest<MeView>('PATCH /me/profile', { body, version });

export const sessionsQuery = () => queryOptions({ queryKey: meKeys.sessions(), queryFn: () => apiRequest<{ items: SessionView[] }>('GET /me/sessions') });

export const revokeSession = (id: string) => apiRequest<void>('DELETE /me/sessions/:id', { params: { id } });

export const revokeOtherSessions = () => apiRequest<{ revoked: number }>('DELETE /me/sessions');

export const loginsQuery = () => queryOptions({ queryKey: meKeys.logins(), queryFn: () => apiRequest<{ items: LoginView[] }>('GET /me/logins') });

export const startLoginLink = (body: { email: string }) => apiRequest<OtpIssued>('POST /me/logins', { body });

export const verifyLoginLink = (body: { challengeId: string; otp: string }) => apiRequest<LoginView>('POST /me/logins/verify', { body });

export const removeLogin = (id: string) => apiRequest<void>('DELETE /me/logins/:id', { params: { id } });

export const startMobileChange = (body: { mobile: string; countryCode?: string }) => apiRequest<OtpIssued>('POST /me/mobile-change', { body });

export const verifyMobileChange = (body: { challengeId: string; otp: string }) => apiRequest<MeView>('POST /me/mobile-change/verify', { body });

export const setPushToken = (token: string | null) => apiRequest<unknown>('PUT /me/sessions/current/push-token', { body: { token } });
