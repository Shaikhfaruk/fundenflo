import 'server-only';

import type { NextResponse } from 'next/server';

import { REFRESH_COOKIE_PATH, SessionCookie } from '@/lib/constants/session.constants';
import { secureCookies } from './env';
import type { AuthResult, TokenPair } from './token-pair';

type CookieReader = { get(name: string): { value: string } | undefined };

export type SessionTokens = { accessToken: string | null; refreshToken: string | null };

export const readTokens = (cookies: CookieReader): SessionTokens => ({
  accessToken: cookies.get(SessionCookie.Access)?.value ?? null,
  refreshToken: cookies.get(SessionCookie.Refresh)?.value ?? null,
});

export function writeSession(response: NextResponse, tokens: TokenPair, context: string | null) {
  const base = { secure: secureCookies, sameSite: 'lax' as const };
  const expiresAt = Date.now() + tokens.expiresIn * 1000;
  response.cookies.set(SessionCookie.Access, tokens.accessToken, { ...base, httpOnly: true, path: '/', maxAge: tokens.expiresIn });
  response.cookies.set(SessionCookie.Refresh, tokens.refreshToken, { ...base, httpOnly: true, path: REFRESH_COOKIE_PATH, maxAge: tokens.refreshExpiresIn });
  response.cookies.set(SessionCookie.ExpiresAt, String(expiresAt), { ...base, httpOnly: false, path: '/', maxAge: tokens.refreshExpiresIn });
  response.cookies.set(SessionCookie.Context, context ?? 'none', { ...base, httpOnly: false, path: '/', maxAge: tokens.refreshExpiresIn });
}

export function clearSession(response: NextResponse) {
  response.cookies.set(SessionCookie.Access, '', { path: '/', maxAge: 0 });
  response.cookies.set(SessionCookie.Refresh, '', { path: REFRESH_COOKIE_PATH, maxAge: 0 });
  response.cookies.set(SessionCookie.ExpiresAt, '', { path: '/', maxAge: 0 });
  response.cookies.set(SessionCookie.Context, '', { path: '/', maxAge: 0 });
}

export const contextOf = (result: AuthResult) => result.user.activeContext?.context ?? 'none';
