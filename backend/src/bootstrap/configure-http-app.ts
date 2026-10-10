import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { Redis } from 'ioredis';
import { Logger } from 'nestjs-pino';

import { API_PREFIX, HttpHeader, UNPREFIXED_ROUTES } from '../common/constants/http.constants.js';
import { requestIdMiddleware } from '../common/http/request-id.middleware.js';
import { APP_CONFIG } from '../config/config.constants.js';
import type { AppConfig } from '../config/env.schema.js';
import { RedisIoAdapter } from '../infrastructure/realtime/redis-io.adapter.js';
import { REDIS_CLIENT } from '../infrastructure/redis/redis.module.js';

export function configureHttpApp(app: NestExpressApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
    exposedHeaders: [HttpHeader.RequestId, HttpHeader.ETag, HttpHeader.RetryAfter, HttpHeader.IdempotentReplay],
  });
  app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
  app.useWebSocketAdapter(new RedisIoAdapter(app, app.get<Redis>(REDIS_CLIENT), config.CORS_ORIGINS));
  app.enableShutdownHooks();
  return config;
}
