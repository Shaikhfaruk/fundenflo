import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, from, mergeMap, type Observable, of, throwError } from 'rxjs';

import { HttpHeader, IDEMPOTENCY_KEY_PATTERN, IDEMPOTENCY_TTL_HOURS } from '../../common/constants/http.constants.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import '../../common/http/request.types.js';
import { stableStringify } from '../../common/utils/stable-json.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { sha256 } from '../crypto/secure-random.js';
import { isUniqueViolation } from '../database/prisma-errors.js';
import { PrismaService } from '../database/prisma.service.js';
import { HOUR_MS } from '../../common/constants/time.constants.js';

type Claim = { scope: string; key: string; requestHash: string };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const key = request.header(HttpHeader.IdempotencyKey);
    if (!key) return next.handle();
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, {
        details: [{ path: HttpHeader.IdempotencyKey, code: 'invalid_format', message: 'must be 8-128 URL-safe characters' }],
      });
    }

    const claim: Claim = {
      scope: `${request.actor?.userId ?? 'anonymous'}:${request.method}:${String(request.route?.path ?? request.path)}`,
      key,
      requestHash: sha256(stableStringify(request.body ?? null)),
    };

    return from(this.claim(claim)).pipe(
      mergeMap((replay) => {
        if (replay) {
          response.status(replay.status);
          response.setHeader(HttpHeader.IdempotentReplay, 'true');
          return of(replay.body);
        }
        return next.handle().pipe(
          mergeMap((body: unknown) => from(this.complete(claim, response.statusCode, body)).pipe(mergeMap(() => of(body)))),
          catchError((error: unknown) => from(this.release(claim)).pipe(mergeMap(() => throwError(() => error)))),
        );
      }),
    );
  }

  private async claim(claim: Claim): Promise<{ status: number; body: unknown } | null> {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * HOUR_MS);
    try {
      await this.prisma.idempotencyKey.create({ data: { ...claim, expiresAt } });
      return null;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    const existing = await this.prisma.idempotencyKey.findUnique({ where: { scope_key: { scope: claim.scope, key: claim.key } } });
    if (!existing) throw new AppError(ErrorCode.IDEMPOTENCY_IN_PROGRESS);
    if (existing.expiresAt < new Date()) {
      await this.prisma.idempotencyKey.delete({ where: { scope_key: { scope: claim.scope, key: claim.key } } });
      return this.claim(claim);
    }
    if (existing.requestHash !== claim.requestHash) throw new AppError(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    if (!existing.completedAt || existing.responseStatus === null) throw new AppError(ErrorCode.IDEMPOTENCY_IN_PROGRESS);
    return { status: existing.responseStatus, body: existing.responseBody };
  }

  private async complete(claim: Claim, status: number, body: unknown) {
    await this.prisma.idempotencyKey.update({
      where: { scope_key: { scope: claim.scope, key: claim.key } },
      data: { responseStatus: status, responseBody: (body ?? null) as Prisma.InputJsonValue, completedAt: new Date() },
    });
  }

  private async release(claim: Claim) {
    await this.prisma.idempotencyKey.deleteMany({ where: { scope: claim.scope, key: claim.key, completedAt: null } });
  }
}
