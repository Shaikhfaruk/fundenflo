import { NextResponse, type NextRequest } from 'next/server';

import { backendJson } from '@/lib/server/backend';
import { isSameOrigin } from '@/lib/server/same-origin';
import { clearSession, readTokens } from '@/lib/server/session-cookies';
import { crossSiteResponse } from '@/lib/server/session-response';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return crossSiteResponse();
  const { accessToken } = readTokens(request.cookies);
  if (accessToken) await backendJson('POST /auth/logout', { accessToken });
  const response = new NextResponse(null, { status: 204 });
  clearSession(response);
  return response;
}
