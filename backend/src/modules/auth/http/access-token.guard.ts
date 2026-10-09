import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ALLOWED_CONTEXTS_KEY, DEFAULT_ALLOWED_CONTEXTS, IS_PUBLIC_KEY } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { RequestContext } from '../../../common/context/request-context.service.js';
import type { SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import '../../../common/http/request.types.js';
import { RevocationRegistry } from '../../../infrastructure/security/revocation.service.js';
import { TokenService } from '../application/token.service.js';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly revocations: RevocationRegistry,
    private readonly context: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header('authorization');
    if (!header?.startsWith(BEARER_PREFIX)) throw new AppError(ErrorCode.UNAUTHENTICATED);

    const claims = await this.tokens.verifyAccessToken(header.slice(BEARER_PREFIX.length).trim());
    if (await this.revocations.isRevoked({ sessionId: claims.sessionId, userId: claims.userId, membershipId: claims.membershipId })) {
      throw new AppError(ErrorCode.SESSION_REVOKED);
    }

    const allowed = this.reflector.getAllAndOverride<SessionContext[] | undefined>(ALLOWED_CONTEXTS_KEY, targets) ?? DEFAULT_ALLOWED_CONTEXTS;
    if (!allowed.includes(claims.context)) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED, { details: { context: claims.context, allowed } });

    const actor: UserActor = { type: 'user', ...claims };
    request.actor = actor;
    this.context.setActor(actor);
    return true;
  }
}
