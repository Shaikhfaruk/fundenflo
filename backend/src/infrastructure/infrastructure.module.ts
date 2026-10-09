import { randomUUID } from 'node:crypto';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { Request } from 'express';
import { ClsModule, type ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';

import { RequestContextModule } from '../common/context/request-context.module.js';
import type { RequestContextStore } from '../common/context/request-context.service.js';
import { APP_CONFIG } from '../config/config.constants.js';
import { ConfigModule } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { DatabaseModule } from './database/database.module.js';
import { PrismaService } from './database/prisma.service.js';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor.js';
import { IdempotencyMaintenance } from './idempotency/idempotency.maintenance.js';
import { buildLoggerParams } from './logger/logger.config.js';
import { OutboxService } from './outbox/outbox.service.js';
import { QueueModule } from './queue/queue.module.js';
import { IpRateLimitGuard } from './rate-limit/rate-limit.guard.js';
import { RateLimiter } from './rate-limit/rate-limiter.service.js';
import { RedisModule } from './redis/redis.module.js';
import { RevocationRegistry } from './security/revocation.service.js';
import { StorageModule } from './storage/storage.module.js';

export type InfrastructureOptions = {
  processName: 'api' | 'worker' | 'script';
};

const sharedProviders = [OutboxService, RateLimiter, RevocationRegistry, IdempotencyInterceptor, IdempotencyMaintenance, IpRateLimitGuard];

@Global()
@Module({})
export class InfrastructureModule {
  static forRoot(options: InfrastructureOptions): DynamicModule {
    const http = options.processName === 'api';
    return {
      module: InfrastructureModule,
      imports: [
        ConfigModule,
        RequestContextModule,
        LoggerModule.forRootAsync({
          inject: [APP_CONFIG],
          useFactory: (config: AppConfig) => buildLoggerParams(config, options.processName),
        }),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: http,
            generateId: true,
            idGenerator: (request: Request) => (typeof request.id === 'string' ? request.id : randomUUID()),
            setup: (cls, request: Request) => {
              const store = cls as ClsService<RequestContextStore>;
              store.set('ip', request.ip);
              store.set('userAgent', request.header('user-agent'));
            },
          },
          plugins: [
            new ClsPluginTransactional({
              imports: [DatabaseModule],
              adapter: new TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService, sqlFlavor: 'postgresql' }),
            }),
          ],
        }),
        DatabaseModule,
        RedisModule,
        CryptoModule,
        StorageModule,
        QueueModule,
      ],
      providers: sharedProviders,
      exports: sharedProviders,
    };
  }
}
