import { apiRequest } from './client';
import type { OtpIssued, StaffLoginResult } from './types/auth.types';

export type OtpRequestInput = { mobile?: string; countryCode?: string; email?: string; loginAs: string; referralCode?: string };

export const requestOtp = (body: OtpRequestInput) => apiRequest<OtpIssued>('POST /auth/otp/request', { body });

export const staffLogin = (body: { email: string; password: string }) => apiRequest<StaffLoginResult>('POST /auth/staff/login', { body });

export const acceptStaffInvitation = (body: { token: string; password: string; fullName: string }) => apiRequest<{ userId: string; email: string }>('POST /auth/staff/invitations/accept', { body });
