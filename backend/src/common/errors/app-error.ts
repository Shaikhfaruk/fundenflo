import { ERROR_CATALOG, type ErrorCode } from './error-codes.js';

export type AppErrorOptions = {
  message?: string;
  details?: unknown;
  retryAfterSeconds?: number;
  cause?: unknown;
};

export class AppError extends Error {
  readonly status: number;
  readonly details: unknown;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    readonly code: ErrorCode,
    options: AppErrorOptions = {},
  ) {
    super(options.message ?? ERROR_CATALOG[code].message, { cause: options.cause });
    this.name = 'AppError';
    this.status = ERROR_CATALOG[code].status;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
