import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const InjectRedis = () => Inject(REDIS_CLIENT);

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3, enableAutoPipelining: true }),
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
