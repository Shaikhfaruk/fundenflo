import 'server-only';

import { BACKEND_API_PREFIX, HttpHeader } from '@/lib/constants/http.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import type { BackendRoute } from '@/lib/api/backend-routes';
import { endpoint } from '@/lib/api/endpoint';
import { serverEnv } from './env';

export const backendUrl = (path: string, search = '') => `${serverEnv.API_ORIGIN}${BACKEND_API_PREFIX}/${path.replace(/^\/+/, '')}${search}`;

export type BackendJson<T> = { ok: true; status: number; data: T; headers: Headers } | { ok: false; status: number; error: BackendError; headers: Headers };

type BackendError = { code: string; message: string; details?: unknown; requestId?: string };

const parseJson = (text: string): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export async function backendJson<T>(route: BackendRoute, init: { body?: unknown; accessToken?: string | null; headers?: Record<string, string> } = {}): Promise<BackendJson<T>> {
  const { method, path } = endpoint(route);
  const headers = new Headers(init.headers);
  headers.set(HttpHeader.Accept, 'application/json');
  if (init.body !== undefined) headers.set(HttpHeader.ContentType, 'application/json');
  if (init.accessToken) headers.set(HttpHeader.Authorization, `Bearer ${init.accessToken}`);
  let response: Response;
  try {
    response = await fetch(backendUrl(path), { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), cache: 'no-store' });
  } catch {
    return { ok: false, status: 503, error: { code: ErrorCode.ServiceUnavailable, message: 'The service is temporarily unavailable. Please try again.' }, headers: new Headers() };
  }
  const parsed = parseJson(await response.text());
  if (response.ok) return { ok: true, status: response.status, data: parsed as T, headers: response.headers };
  return { ok: false, status: response.status, error: (parsed as BackendError | null) ?? { code: ErrorCode.InternalError, message: response.statusText }, headers: response.headers };
}
