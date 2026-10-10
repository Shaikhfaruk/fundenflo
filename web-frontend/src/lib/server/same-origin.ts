import 'server-only';

import type { NextRequest } from 'next/server';

import { HttpHeader, SAFE_METHODS } from '@/lib/constants/http.constants';
import { serverEnv } from './env';

export function isSameOrigin(request: NextRequest): boolean {
  if (SAFE_METHODS.includes(request.method)) return true;
  const origin = request.headers.get(HttpHeader.Origin);
  if (!origin) return false;
  return origin === serverEnv.APP_ORIGIN || origin === request.nextUrl.origin;
}
