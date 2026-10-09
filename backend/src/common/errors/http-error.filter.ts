import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { Prisma } from '../../generated/prisma/client.js';
import { HttpHeader } from '../constants/http.constants.js';
import { AppError } from './app-error.js';
import { ErrorCode } from './error-codes.js';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const error = this.normalise(exception);

    if (error.status >= 500) {
      this.logger.error({ err: exception, requestId: request.id }, 'Request failed');
    }
    if (error.retryAfterSeconds) {
      response.setHeader(HttpHeader.RetryAfter, String(error.retryAfterSeconds));
    }

    response.status(error.status).json({
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
      requestId: request.id,
    });
  }

  private normalise(exception: unknown): AppError {
    if (exception instanceof AppError) return exception;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return new AppError(ErrorCode.CONFLICT, { cause: exception });
      if (exception.code === 'P2025') return new AppError(ErrorCode.NOT_FOUND, { cause: exception });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 404) return new AppError(ErrorCode.ROUTE_NOT_FOUND);
      if (status === 401) return new AppError(ErrorCode.UNAUTHENTICATED);
      if (status === 403) return new AppError(ErrorCode.FORBIDDEN);
      if (status === 413) return new AppError(ErrorCode.PAYLOAD_TOO_LARGE);
      if (status === 429) return new AppError(ErrorCode.RATE_LIMITED);
      if (status === 503) return new AppError(ErrorCode.SERVICE_UNAVAILABLE, { details: exception.getResponse() });
      if (status < 500) return new AppError(ErrorCode.BAD_REQUEST);
    }

    return new AppError(ErrorCode.INTERNAL_ERROR, { cause: exception });
  }
}
