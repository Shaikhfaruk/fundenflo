import { applyDecorators, type CanActivate, type ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { RATE_LIMIT_METADATA, type RateLimitRule } from './rate-limit.constants.js';
import { RateLimiter } from './rate-limiter.service.js';

@Injectable()
export class IpRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.get<RateLimitRule[] | undefined>(RATE_LIMIT_METADATA, context.getHandler()) ?? [];
    const ip = context.switchToHttp().getRequest<Request>().ip ?? 'unknown';
    for (const rule of rules) {
      const result = await this.limiter.consume(`${rule.name}:ip:${ip}`, rule.limit, rule.windowSeconds);
      if (!result.allowed) throw new AppError(ErrorCode.RATE_LIMITED, { retryAfterSeconds: result.retryAfterSeconds });
    }
    return true;
  }
}

export const RateLimitByIp = (...rules: RateLimitRule[]) =>
  applyDecorators(SetMetadata(RATE_LIMIT_METADATA, rules), UseGuards(IpRateLimitGuard));
