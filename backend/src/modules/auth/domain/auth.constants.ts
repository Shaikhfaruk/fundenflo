export const OTP_LENGTH = 6;

export const OTP_TTL_SECONDS = 300;

export const OTP_RESEND_SECONDS = 30;

export const OTP_MAX_ATTEMPTS = 5;

export const OtpLimit = {
  requestsPerIdentifier: { limit: 5, windowSeconds: 3600 },
  failuresPerIdentifier: { limit: 10, windowSeconds: 3600 },
} as const;

export const RateLimitRules = {
  otpRequest: { name: 'otp-request', limit: 30, windowSeconds: 3600 },
  otpVerify: { name: 'otp-verify', limit: 60, windowSeconds: 3600 },
  tokenRefresh: { name: 'token-refresh', limit: 120, windowSeconds: 3600 },
  staffLogin: { name: 'staff-login', limit: 20, windowSeconds: 900 },
  staffMfa: { name: 'staff-mfa', limit: 30, windowSeconds: 900 },
  invitationAccept: { name: 'invitation-accept', limit: 10, windowSeconds: 3600 },
} as const;

export const RateLimitKey = {
  otpRequests: (purpose: string, identifierHash: string) => `otp:req:${purpose}:${identifierHash}`,
  otpFailures: (identifierHash: string) => `otp:fail:${identifierHash}`,
} as const;

export const REFRESH_TOKEN_BYTES = 48;

export const ACCESS_TOKEN_TYPE = 'at+jwt';

export const ACCESS_TOKEN_ALGORITHM = 'ES256';

export const STAFF_LOGIN_MAX_FAILURES = 5;

export const STAFF_LOCK_MINUTES = 15;

export const STAFF_PASSWORD_MIN_LENGTH = 12;

export const STAFF_PASSWORD_MAX_LENGTH = 128;

export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const MFA_TOKEN_TTL_SECONDS = 300;

export const MFA_MAX_ATTEMPTS = 5;

export const MfaKey = {
  challenge: (tokenHash: string) => `auth:mfa:${tokenHash}`,
  usedCounter: (userId: string, counter: number) => `auth:totp-used:${userId}:${counter}`,
} as const;

export const TOTP_SETTINGS = { issuer: 'FundenFlo', algorithm: 'SHA1', digits: 6, period: 30, window: 1, secretBytes: 20 } as const;

export const SignupChannel = {
  MobileOtp: 'mobile_otp',
  EmailOtp: 'email_otp',
  StaffInvitation: 'staff_invitation',
} as const;
