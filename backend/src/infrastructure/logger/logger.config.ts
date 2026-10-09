import type { Params } from 'nestjs-pino';

import type { AppConfig } from '../../config/env.schema.js';
import { LOG_REDACT_PATHS, SERVICE_NAME } from './logger.constants.js';

export function buildLoggerParams(config: AppConfig, processName: string): Params {
  return {
    pinoHttp: {
      level: config.LOG_LEVEL,
      base: { service: SERVICE_NAME, process: processName },
      genReqId: (request) => request.id,
      redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' },
      autoLogging: { ignore: (request) => (request.url ?? '').startsWith('/health') },
      serializers: {
        req: (request: { id: unknown; method: string; url?: string }) => ({
          id: request.id,
          method: request.method,
          path: (request.url ?? '').split('?')[0],
        }),
        res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
      },
      customLogLevel: (_request, response, error) => {
        if (error || response.statusCode >= 500) return 'error';
        if (response.statusCode >= 400) return 'warn';
        return 'info';
      },
      transport:
        config.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' } }
          : undefined,
    },
  };
}
