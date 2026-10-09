import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { type Observable, tap } from 'rxjs';

import { HttpHeader } from '../constants/http.constants.js';

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap((body: unknown) => {
        if (response.headersSent || !body || typeof body !== 'object') return;
        const version = (body as { version?: unknown }).version;
        if (typeof version === 'number') response.setHeader(HttpHeader.ETag, `"${version}"`);
      }),
    );
  }
}
