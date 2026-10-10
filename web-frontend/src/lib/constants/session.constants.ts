export const SessionCookie = {
  Access: 'ff_at',
  Refresh: 'ff_rt',
  ExpiresAt: 'ff_exp',
  Context: 'ff_ctx',
} as const;

export const REFRESH_COOKIE_PATH = '/api/session';

export const ACCESS_REFRESH_LEEWAY_MS = 30_000;

export const REFRESH_RESULT_REUSE_MS = 10_000;

export const REFRESH_LOCK_NAME = 'fundenflo-session-refresh';

export const SESSION_CHANNEL_NAME = 'fundenflo-session';
