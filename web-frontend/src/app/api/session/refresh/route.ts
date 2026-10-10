import type { NextRequest } from 'next/server';

import { SESSION_ENDING_ERRORS } from '@/lib/constants/errors.constants';
import { refreshOnce } from '@/lib/server/refresh';
import { isSameOrigin } from '@/lib/server/same-origin';
import { readTokens } from '@/lib/server/session-cookies';
import { crossSiteResponse, sessionResponse, signedOutResponse } from '@/lib/server/session-response';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return crossSiteResponse();
  const { refreshToken } = readTokens(request.cookies);
  if (!refreshToken) return signedOutResponse();
  const result = await refreshOnce(refreshToken);
  return sessionResponse(result, !result.ok && SESSION_ENDING_ERRORS.includes(result.error.code));
}
