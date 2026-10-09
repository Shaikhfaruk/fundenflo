export const RATE_LIMIT_KEY_PREFIX = 'ratelimit:';

export const RATE_LIMIT_METADATA = 'rate-limit:rules';

export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
};
