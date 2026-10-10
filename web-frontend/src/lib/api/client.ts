import { REFRESHABLE_ERRORS, SESSION_ENDING_ERRORS } from '@/lib/constants/errors.constants';
import { BFF_API_PREFIX, HttpHeader } from '@/lib/constants/http.constants';
import { ensureFreshSession, refreshSession } from '@/lib/session/client-session';
import { emitSession, SessionSignal } from '@/lib/session/session-events';
import { ApiError, networkError, type ErrorBody } from './api-error';
import type { BackendRoute } from './backend-routes';
import { endpoint, type PathParams, type QueryValue, queryString } from './endpoint';

export type RequestOptions = {
  params?: PathParams;
  query?: Record<string, QueryValue>;
  body?: unknown;
  version?: number;
  idempotent?: boolean;
  signal?: AbortSignal;
};

const send = (url: string, method: string, options: RequestOptions) => {
  const headers = new Headers({ [HttpHeader.Accept]: 'application/json' });
  if (typeof document !== 'undefined' && document.documentElement.lang) headers.set(HttpHeader.AcceptLanguage, document.documentElement.lang);
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers.set(HttpHeader.ContentType, 'application/json');
  if (options.version !== undefined) headers.set(HttpHeader.IfMatch, `"${options.version}"`);
  if (options.idempotent) headers.set(HttpHeader.IdempotencyKey, crypto.randomUUID());
  return fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    signal: options.signal,
    body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  });
};

const readError = async (response: Response) => {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return new ApiError(response.status, body ?? { code: 'INTERNAL_ERROR', message: response.statusText }, response.headers.get(HttpHeader.RetryAfter));
};

export async function apiRequest<T>(route: BackendRoute, options: RequestOptions = {}): Promise<T> {
  const { method, path } = endpoint(route, options.params);
  const url = `${BFF_API_PREFIX}${path}${queryString(options.query)}`;
  await ensureFreshSession();
  let response: Response;
  try {
    response = await send(url, method, options);
    if (response.status === 401) {
      const error = await readError(response);
      if (!REFRESHABLE_ERRORS.includes(error.code)) {
        if (SESSION_ENDING_ERRORS.includes(error.code)) emitSession(SessionSignal.Ended);
        throw error;
      }
      if (!(await refreshSession(true))) throw error;
      response = await send(url, method, options);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw networkError();
  }
  if (!response.ok) {
    const error = await readError(response);
    if (response.status === 401 && SESSION_ENDING_ERRORS.includes(error.code)) emitSession(SessionSignal.Ended);
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
