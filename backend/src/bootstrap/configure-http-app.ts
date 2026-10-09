import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { API_PREFIX, HttpHeader, UNPREFIXED_ROUTES } from '../common/constants/http.constants.js';
import { requestIdMiddleware } from '../common/http/request-id.middleware.js';
import { APP_CONFIG } from '../config/config.constants.js';
import type { AppConfig } from '../config/env.schema.js';

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
  app.enableShutdownHooks();
  return config;
}
