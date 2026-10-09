import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { type Locale, resolveLocale } from './locale.js';

export const RequestLocale = createParamDecorator((_: unknown, context: ExecutionContext): Locale => {
  const request = context.switchToHttp().getRequest<Request>();
  const query = typeof request.query.locale === 'string' ? request.query.locale : undefined;
  return resolveLocale(query, request.header('accept-language'));
});
