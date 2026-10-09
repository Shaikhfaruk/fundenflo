import { applyDecorators, type CanActivate, createParamDecorator, type ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { Public } from '../../../common/auth/auth.decorators.js';
import { HttpHeader } from '../../../common/constants/http.constants.js';
import { RequestContext } from '../../../common/context/request-context.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { RateLimiter } from '../../../infrastructure/rate-limit/rate-limiter.service.js';
import { type AuthenticatedApiClient, ApiClientService } from '../application/api-client.service.js';
import { API_KEY_RATE_LIMIT, type ApiScope } from '../domain/access.constants.js';

const API_SCOPE_METADATA = 'access:api-scope';

const API_CLIENT_REQUEST_KEY = Symbol('access:api-client');

type RequestWithClient = Request & { [API_CLIENT_REQUEST_KEY]?: AuthenticatedApiClient };

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clients: ApiClientService,
    private readonly limiter: RateLimiter,
    private readonly context: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.get<ApiScope | undefined>(API_SCOPE_METADATA, context.getHandler());
    const request = context.switchToHttp().getRequest<RequestWithClient>();
    const client = await this.clients.authenticate(request.header(HttpHeader.ApiKey));
    if (scope && !client.scopes.includes(scope)) throw new AppError(ErrorCode.FORBIDDEN, { details: { requiredScope: scope } });
    const quota = await this.limiter.consume(`${API_KEY_RATE_LIMIT.name}:${client.actor.apiClientId}`, API_KEY_RATE_LIMIT.limit, API_KEY_RATE_LIMIT.windowSeconds);
    if (!quota.allowed) throw new AppError(ErrorCode.RATE_LIMITED, { retryAfterSeconds: quota.retryAfterSeconds });
    this.context.setActor(client.actor);
    request[API_CLIENT_REQUEST_KEY] = client;
    return true;
  }
}

export const ApiKeyAuth = (scope: ApiScope) => applyDecorators(Public(), SetMetadata(API_SCOPE_METADATA, scope), UseGuards(ApiKeyGuard));

export const CurrentApiClient = createParamDecorator((_: unknown, context: ExecutionContext): AuthenticatedApiClient => {
  const client = context.switchToHttp().getRequest<RequestWithClient>()[API_CLIENT_REQUEST_KEY];
  if (!client) throw new AppError(ErrorCode.API_KEY_INVALID);
  return client;
});
