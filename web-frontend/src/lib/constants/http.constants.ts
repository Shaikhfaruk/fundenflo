export const BACKEND_API_PREFIX = '/v1';

export const BFF_API_PREFIX = '/api/v1';

export const SessionRoute = {
  OtpVerify: '/api/session/otp-verify',
  MfaVerify: '/api/session/mfa-verify',
  SwitchContext: '/api/session/switch-context',
  Refresh: '/api/session/refresh',
  Logout: '/api/session/logout',
  SocketToken: '/api/session/socket-token',
} as const;

export const HttpHeader = {
  Authorization: 'authorization',
  ContentType: 'content-type',
  ContentLength: 'content-length',
  Accept: 'accept',
  AcceptLanguage: 'accept-language',
  IfMatch: 'if-match',
  IdempotencyKey: 'idempotency-key',
  RequestId: 'x-request-id',
  RetryAfter: 'retry-after',
  ContentDisposition: 'content-disposition',
  ETag: 'etag',
  Origin: 'origin',
  UserAgent: 'user-agent',
  ForwardedFor: 'x-forwarded-for',
} as const;

export const FORWARDED_REQUEST_HEADERS: readonly string[] = [
  HttpHeader.ContentType,
  HttpHeader.Accept,
  HttpHeader.AcceptLanguage,
  HttpHeader.IfMatch,
  HttpHeader.IdempotencyKey,
  HttpHeader.RequestId,
  HttpHeader.UserAgent,
];

export const FORWARDED_RESPONSE_HEADERS: readonly string[] = [
  HttpHeader.ContentType,
  HttpHeader.ContentDisposition,
  HttpHeader.RequestId,
  HttpHeader.RetryAfter,
  HttpHeader.ETag,
];

export const SESSION_ISSUING_BACKEND_PATHS: readonly string[] = ['auth/otp/verify', 'auth/staff/mfa/verify', 'auth/switch-context', 'auth/token/refresh', 'auth/logout'];

export const SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS'];

export const OPTION_PAGE_SIZE = 100;

export const OPTION_MAX_PAGES = 20;
