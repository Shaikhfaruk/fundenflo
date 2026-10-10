import 'server-only';

import { NextResponse } from 'next/server';

import { ErrorCode } from '@/lib/constants/errors.constants';
import { HttpHeader } from '@/lib/constants/http.constants';
import type { SessionPayload } from '@/lib/api/types/auth.types';
import type { BackendJson } from './backend';
import { clearSession, contextOf, writeSession } from './session-cookies';
import type { AuthResult } from './token-pair';

function errorResponse(result: Extract<BackendJson<unknown>, { ok: false }>, endSession = false) {
  const response = NextResponse.json(result.error, { status: result.status });
  for (const header of [HttpHeader.RetryAfter, HttpHeader.RequestId]) {
    const value = result.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  if (endSession) clearSession(response);
  return response;
}

export function sessionResponse(result: BackendJson<AuthResult>, endSessionOnError = false) {
  if (!result.ok) return errorResponse(result, endSessionOnError);
  const payload: SessionPayload = { user: result.data.user, nextAction: result.data.nextAction, expiresAt: Date.now() + result.data.expiresIn * 1000 };
  const response = NextResponse.json(payload);
  writeSession(response, result.data, contextOf(result.data));
  return response;
}

export const crossSiteResponse = () => NextResponse.json({ code: ErrorCode.Forbidden, message: 'Requests from other sites are not allowed.' }, { status: 403 });

export const signedOutResponse = () => {
  const response = NextResponse.json({ code: ErrorCode.Unauthenticated, message: 'Sign in to continue.' }, { status: 401 });
  clearSession(response);
  return response;
};
