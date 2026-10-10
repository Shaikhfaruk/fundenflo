import { ApiError, networkError, type ErrorBody } from '@/lib/api/api-error';
import type { SessionPayload } from '@/lib/api/types/auth.types';
import { SESSION_ENDING_ERRORS } from '@/lib/constants/errors.constants';
import { HttpHeader, SessionRoute } from '@/lib/constants/http.constants';
import { REFRESH_LOCK_NAME } from '@/lib/constants/session.constants';
import { accessNeedsRefresh, hasSession, sessionExpiresAt } from './session-cookie';
import { emitSession, SessionSignal } from './session-events';

async function post<T>(url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? {} : { [HttpHeader.ContentType]: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw networkError();
  }
  if (response.status === 204) return undefined as T;
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new ApiError(response.status, (parsed as ErrorBody | null) ?? { code: 'INTERNAL_ERROR', message: response.statusText }, response.headers.get(HttpHeader.RetryAfter));
  return parsed as T;
}

let running: Promise<boolean> | null = null;

async function refreshNow(): Promise<boolean> {
  try {
    await post<SessionPayload>(SessionRoute.Refresh);
    emitSession(SessionSignal.Changed);
    return true;
  } catch (error) {
    if (error instanceof ApiError && SESSION_ENDING_ERRORS.includes(error.code)) {
      emitSession(SessionSignal.Ended);
      return false;
    }
    throw error;
  }
}

export function refreshSession(force = false): Promise<boolean> {
  if (running) return running;
  const seen = sessionExpiresAt();
  const decide = () => {
    if (!hasSession()) return Promise.resolve(false);
    if (sessionExpiresAt() !== seen) return Promise.resolve(true);
    if (!force && !accessNeedsRefresh()) return Promise.resolve(true);
    return refreshNow();
  };
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run = async (): Promise<boolean> => (locks ? await locks.request(REFRESH_LOCK_NAME, decide) : decide());
  const tracked = run().finally(() => {
    running = null;
  });
  running = tracked;
  return tracked;
}

export async function ensureFreshSession() {
  if (accessNeedsRefresh()) await refreshSession();
}

export const verifyOtp = (body: unknown) => post<SessionPayload>(SessionRoute.OtpVerify, body).then((payload) => {
  emitSession(SessionSignal.Changed);
  return payload;
});

export const verifyMfa = (body: unknown) => post<SessionPayload>(SessionRoute.MfaVerify, body).then((payload) => {
  emitSession(SessionSignal.Changed);
  return payload;
});

export const switchContext = (body: { membershipId: string } | { loginAs: 'borrower' }) => post<SessionPayload>(SessionRoute.SwitchContext, body).then((payload) => {
  emitSession(SessionSignal.Changed);
  return payload;
});

export async function signOut() {
  await post<void>(SessionRoute.Logout).catch(() => undefined);
  emitSession(SessionSignal.Ended);
}
