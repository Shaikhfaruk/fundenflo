import 'server-only';

import { REFRESH_RESULT_REUSE_MS } from '@/lib/constants/session.constants';
import { backendJson, type BackendJson } from './backend';
import type { AuthResult } from './token-pair';

type Settled = { result: BackendJson<AuthResult>; settledAt: number };

const inFlight = new Map<string, Promise<BackendJson<AuthResult>>>();
const recent = new Map<string, Settled>();

const forget = (now: number) => {
  for (const [token, entry] of recent) if (now - entry.settledAt > REFRESH_RESULT_REUSE_MS) recent.delete(token);
};

export function refreshOnce(refreshToken: string): Promise<BackendJson<AuthResult>> {
  const now = Date.now();
  forget(now);
  const settled = recent.get(refreshToken);
  if (settled) return Promise.resolve(settled.result);
  const running = inFlight.get(refreshToken);
  if (running) return running;
  const call = backendJson<AuthResult>('POST /auth/token/refresh', { body: { refreshToken } }).then((result) => {
    inFlight.delete(refreshToken);
    recent.set(refreshToken, { result, settledAt: Date.now() });
    return result;
  });
  inFlight.set(refreshToken, call);
  return call;
}
