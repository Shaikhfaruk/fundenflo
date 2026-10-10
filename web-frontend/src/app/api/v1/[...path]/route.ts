import { NextResponse, type NextRequest } from 'next/server';

import { ErrorCode } from '@/lib/constants/errors.constants';
import { FORWARDED_REQUEST_HEADERS, FORWARDED_RESPONSE_HEADERS, HttpHeader, SAFE_METHODS, SESSION_ISSUING_BACKEND_PATHS } from '@/lib/constants/http.constants';
import { SessionCookie } from '@/lib/constants/session.constants';
import { backendUrl } from '@/lib/server/backend';
import { isSameOrigin } from '@/lib/server/same-origin';
import { readTokens } from '@/lib/server/session-cookies';
import { crossSiteResponse } from '@/lib/server/session-response';

const expired = () => NextResponse.json({ code: ErrorCode.TokenExpired, message: 'Your session has expired. Refresh it or sign in again.' }, { status: 401 });

async function forward(request: NextRequest, ctx: RouteContext<'/api/v1/[...path]'>) {
  const { path } = await ctx.params;
  const joined = path.map((segment) => encodeURIComponent(segment)).join('/');
  if (SESSION_ISSUING_BACKEND_PATHS.includes(path.join('/'))) return NextResponse.json({ code: ErrorCode.NotFound, message: 'The requested record was not found.' }, { status: 404 });
  if (!isSameOrigin(request)) return crossSiteResponse();
  const { accessToken } = readTokens(request.cookies);
  if (!accessToken && request.cookies.get(SessionCookie.ExpiresAt)) return expired();
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const forwardedFor = request.headers.get(HttpHeader.ForwardedFor);
  if (forwardedFor) headers.set(HttpHeader.ForwardedFor, forwardedFor);
  if (accessToken) headers.set(HttpHeader.Authorization, `Bearer ${accessToken}`);
  const hasBody = !SAFE_METHODS.includes(request.method);
  let upstream: Response;
  try {
    upstream = await fetch(backendUrl(joined, request.nextUrl.search), {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      cache: 'no-store',
      redirect: 'manual',
      ...(hasBody ? { duplex: 'half' } : {}),
    });
  } catch {
    return NextResponse.json({ code: ErrorCode.ServiceUnavailable, message: 'The service is temporarily unavailable. Please try again.' }, { status: 503 });
  }
  const responseHeaders = new Headers({ 'cache-control': 'no-store' });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
