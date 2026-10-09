import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import type { UserActor } from '../context/actor.js';
import { SessionContext } from '../enums/db.enums.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';
import '../http/request.types.js';

export const IS_PUBLIC_KEY = 'auth:public';

export const ALLOWED_CONTEXTS_KEY = 'auth:allowed-contexts';

export const DEFAULT_ALLOWED_CONTEXTS: SessionContext[] = [
  SessionContext.borrower,
  SessionContext.partner,
  SessionContext.lender,
  SessionContext.staff,
];

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AllowContexts = (...contexts: SessionContext[]) => SetMetadata(ALLOWED_CONTEXTS_KEY, contexts);

export const AnyContext = () => AllowContexts(...DEFAULT_ALLOWED_CONTEXTS, SessionContext.none);

export const StaffOnly = () => AllowContexts(SessionContext.staff);

export const CurrentActor = createParamDecorator((_: unknown, context: ExecutionContext): UserActor => {
  const actor = context.switchToHttp().getRequest<Request>().actor;
  if (!actor) throw new AppError(ErrorCode.UNAUTHENTICATED);
  return actor;
});
