import { Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { InjectRedis } from '../redis/redis.module.js';
import { CACHE_KEY_PREFIX, CACHE_TAG_PREFIX } from './cache.constants.js';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async wrap<T>(key: string, tags: string[], ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const versionedKey = await this.versionedKey(key, tags);
    try {
      const cached = await this.redis.get(versionedKey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Cache read failed; loading from source');
    }
    const value = await load();
    await this.redis.set(versionedKey, JSON.stringify(value), 'EX', ttlSeconds).catch((error: unknown) => {
      this.logger.warn({ err: error, key }, 'Cache write failed');
    });
    return value;
  }

  async invalidate(...tags: string[]): Promise<void> {
    if (tags.length === 0) return;
    const pipeline = this.redis.pipeline();
    for (const tag of tags) pipeline.incr(`${CACHE_TAG_PREFIX}${tag}`);
    await pipeline.exec();
  }

  private async versionedKey(key: string, tags: string[]): Promise<string> {
    if (tags.length === 0) return `${CACHE_KEY_PREFIX}${key}`;
    const versions = await this.redis.mget(...tags.map((tag) => `${CACHE_TAG_PREFIX}${tag}`));
    return `${CACHE_KEY_PREFIX}${key}:${versions.map((version) => version ?? '0').join('.')}`;
  }
}
