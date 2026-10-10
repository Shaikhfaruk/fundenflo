import { ErrorCode } from '@/lib/constants/errors.constants';

export type FieldIssue = { path: string; code: string; message: string };

export type ErrorBody = { code: string; message: string; details?: unknown; requestId?: string };

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, body: ErrorBody, retryAfter: string | null = null) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.requestId = body.requestId ?? null;
    this.retryAfterSeconds = retryAfter ? Number(retryAfter) : null;
  }

  get fieldIssues(): FieldIssue[] {
    return Array.isArray(this.details) ? (this.details as FieldIssue[]).filter((issue) => typeof issue?.path === 'string') : [];
  }
}

export const networkError = () => new ApiError(0, { code: ErrorCode.NetworkError, message: 'You appear to be offline. Check your connection and try again.' });
