import type { NextRequest } from 'next/server';

import { backendJson } from '@/lib/server/backend';
import { isSameOrigin } from '@/lib/server/same-origin';
import { readTokens } from '@/lib/server/session-cookies';
import { crossSiteResponse, sessionResponse, signedOutResponse } from '@/lib/server/session-response';
import type { AuthResult } from '@/lib/server/token-pair';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return crossSiteResponse();
  const { accessToken } = readTokens(request.cookies);
  if (!accessToken) return signedOutResponse();
  return sessionResponse(await backendJson<AuthResult>('POST /auth/switch-context', { body: await request.json(), accessToken }));
}
