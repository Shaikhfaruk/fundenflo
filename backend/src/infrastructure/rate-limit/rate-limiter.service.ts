import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { InjectRedis } from '../redis/redis.module.js';
import { RATE_LIMIT_KEY_PREFIX } from './rate-limit.constants.js';

const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`;

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
};

@Injectable()
export class RateLimiter {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const [count, ttl] = (await this.redis.eval(CONSUME_SCRIPT, 1, `${RATE_LIMIT_KEY_PREFIX}${key}`, windowSeconds)) as [number, number];
    return {
      allowed: count <= limit,
      count,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }

  async count(key: string): Promise<number> {
    return Number((await this.redis.get(`${RATE_LIMIT_KEY_PREFIX}${key}`)) ?? 0);
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`${RATE_LIMIT_KEY_PREFIX}${key}`);
  }
}
