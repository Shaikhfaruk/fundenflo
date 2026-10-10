export const ErrorCode = {
  BadRequest: 'BAD_REQUEST',
  ValidationFailed: 'VALIDATION_FAILED',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  VersionConflict: 'VERSION_CONFLICT',
  RateLimited: 'RATE_LIMITED',
  Unauthenticated: 'UNAUTHENTICATED',
  TokenInvalid: 'TOKEN_INVALID',
  TokenExpired: 'TOKEN_EXPIRED',
  SessionRevoked: 'SESSION_REVOKED',
  Forbidden: 'FORBIDDEN',
  ContextNotAllowed: 'CONTEXT_NOT_ALLOWED',
  OtpCooldown: 'OTP_COOLDOWN',
  OtpRateLimited: 'OTP_RATE_LIMITED',
  OtpInvalid: 'OTP_INVALID',
  OtpExpired: 'OTP_EXPIRED',
  OtpLocked: 'OTP_LOCKED',
  RefreshTokenInvalid: 'REFRESH_TOKEN_INVALID',
  RefreshTokenReused: 'REFRESH_TOKEN_REUSED',
  UserSuspended: 'USER_SUSPENDED',
  MembershipInactive: 'MEMBERSHIP_INACTIVE',
  ConsentRequired: 'CONSENT_REQUIRED',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  InternalError: 'INTERNAL_ERROR',
  NetworkError: 'NETWORK_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const SESSION_ENDING_ERRORS: readonly string[] = [
  ErrorCode.RefreshTokenInvalid,
  ErrorCode.RefreshTokenReused,
  ErrorCode.SessionRevoked,
  ErrorCode.UserSuspended,
  ErrorCode.MembershipInactive,
  ErrorCode.Unauthenticated,
];

export const REFRESHABLE_ERRORS: readonly string[] = [ErrorCode.TokenExpired];
