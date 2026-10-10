import { REFRESHABLE_ERRORS, SESSION_ENDING_ERRORS } from '@/lib/constants/errors.constants';
import { BFF_API_PREFIX, HttpHeader } from '@/lib/constants/http.constants';
import { ensureFreshSession, refreshSession } from '@/lib/session/client-session';
import { emitSession, SessionSignal } from '@/lib/session/session-events';
import { ApiError, networkError, type ErrorBody } from './api-error';
import type { BackendRoute } from './backend-routes';
import { endpoint } from './endpoint';

type UploadOptions = { onProgress?: (percent: number) => void; signal?: AbortSignal };

type Outcome = { status: number; body: unknown; retryAfter: string | null };

const PERCENT = 100;

const abortError = () => new DOMException('Upload cancelled', 'AbortError');

function send(url: string, form: FormData, options: UploadOptions): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(abortError());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader(HttpHeader.Accept, 'application/json');
    if (document.documentElement.lang) xhr.setRequestHeader(HttpHeader.AcceptLanguage, document.documentElement.lang);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.min(PERCENT, Math.round((event.loaded / event.total) * PERCENT)));
    });
    const onAbort = () => xhr.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });
    xhr.addEventListener('load', () => {
      options.signal?.removeEventListener('abort', onAbort);
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      resolve({ status: xhr.status, body, retryAfter: xhr.getResponseHeader(HttpHeader.RetryAfter) });
    });
    xhr.addEventListener('error', () => {
      options.signal?.removeEventListener('abort', onAbort);
      reject(networkError());
    });
    xhr.addEventListener('abort', () => reject(abortError()));
    xhr.send(form);
  });
}

const toError = (outcome: Outcome) => new ApiError(outcome.status, (outcome.body as ErrorBody | null) ?? { code: 'INTERNAL_ERROR', message: 'Upload failed' }, outcome.retryAfter);

export async function uploadForm<T>(route: BackendRoute, form: FormData, options: UploadOptions = {}): Promise<T> {
  const { path } = endpoint(route);
  const url = `${BFF_API_PREFIX}${path}`;
  await ensureFreshSession();
  let outcome = await send(url, form, options);
  if (outcome.status === 401) {
    const error = toError(outcome);
    if (!REFRESHABLE_ERRORS.includes(error.code)) {
      if (SESSION_ENDING_ERRORS.includes(error.code)) emitSession(SessionSignal.Ended);
      throw error;
    }
    if (!(await refreshSession(true))) throw error;
    outcome = await send(url, form, options);
  }
  if (outcome.status < 200 || outcome.status >= 300) throw toError(outcome);
  return outcome.body as T;
}
