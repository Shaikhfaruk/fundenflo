import { NextResponse, type NextRequest } from 'next/server';

import { ErrorCode } from '@/lib/constants/errors.constants';
import { HttpHeader } from '@/lib/constants/http.constants';
import { serverEnv } from '@/lib/server/env';
import { readTokens } from '@/lib/server/session-cookies';
import { crossSiteResponse } from '@/lib/server/session-response';

export async function POST(request: NextRequest) {
  const origin = request.headers.get(HttpHeader.Origin);
  if (origin !== serverEnv.APP_ORIGIN && origin !== request.nextUrl.origin) return crossSiteResponse();
  const { accessToken } = readTokens(request.cookies);
  if (!accessToken) return NextResponse.json({ code: ErrorCode.TokenExpired, message: 'Your session has expired. Refresh it or sign in again.' }, { status: 401 });
  return NextResponse.json({ token: accessToken, origin: serverEnv.API_ORIGIN }, { headers: { 'cache-control': 'no-store' } });
}
