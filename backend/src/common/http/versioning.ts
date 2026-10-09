import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { HttpHeader } from '../constants/http.constants.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';

const IF_MATCH_PATTERN = /^(?:W\/)?"?(\d+)"?$/;

export const IfMatchVersion = createParamDecorator((_: unknown, context: ExecutionContext): number | undefined => {
  const header = context.switchToHttp().getRequest<Request>().header(HttpHeader.IfMatch);
  if (!header) return undefined;
  const match = IF_MATCH_PATTERN.exec(header.trim());
  if (!match?.[1]) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, {
      details: [{ path: HttpHeader.IfMatch, code: 'invalid_format', message: 'must be a version number such as "3"' }],
    });
  }
  return Number(match[1]);
});

export function assertVersion(expected: number | undefined, current: number) {
  if (expected !== undefined && expected !== current) {
    throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: current } });
  }
}
