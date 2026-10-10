export const API_PREFIX = 'v1';

export const UNPREFIXED_ROUTES = ['health/live', 'health/ready'];

export const COMPAT_PREFIX = 'v0';

export const COMPAT_ROUTES = `${COMPAT_PREFIX}/{*splat}`;

export const JSON_BODY_LIMIT_BYTES = 1_048_576;

export const BODYLESS_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

export const JSON_CONTENT_TYPES = ['application/json', 'application/*+json'];

export const ALL_ROUTES = '{*splat}';

export const HttpHeader = {
  RequestId: 'X-Request-Id',
  IdempotencyKey: 'Idempotency-Key',
  IfMatch: 'If-Match',
  ETag: 'ETag',
  RetryAfter: 'Retry-After',
  IdempotentReplay: 'Idempotent-Replayed',
  ApiKey: 'X-Api-Key',
} as const;

export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export const IDEMPOTENCY_TTL_HOURS = 24;
