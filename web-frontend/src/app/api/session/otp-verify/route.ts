import type { NextRequest } from 'next/server';

import { backendJson } from '@/lib/server/backend';
import { isSameOrigin } from '@/lib/server/same-origin';
import { crossSiteResponse, sessionResponse } from '@/lib/server/session-response';
import type { AuthResult } from '@/lib/server/token-pair';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return crossSiteResponse();
  return sessionResponse(await backendJson<AuthResult>('POST /auth/otp/verify', { body: await request.json() }));
}
