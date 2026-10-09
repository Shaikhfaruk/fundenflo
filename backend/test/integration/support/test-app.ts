import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request from 'supertest';

import { AppModule } from '../../../src/app.module.js';
import { configureHttpApp } from '../../../src/bootstrap/configure-http-app.js';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service.js';
import { REDIS_CLIENT } from '../../../src/infrastructure/redis/redis.module.js';
import { runSeed } from '../../../src/scripts/seed-data/run-seed.js';

export type TestApp = {
  app: NestExpressApplication;
  prisma: PrismaService;
  redis: Redis;
  api: () => ReturnType<typeof request>;
  close: () => Promise<void>;
};

export async function startTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, bufferLogs: true });
  configureHttpApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const redis = app.get<Redis>(REDIS_CLIENT);
  await redis.flushdb();
  await runSeed(prisma, process.env);
  return {
    app,
    prisma,
    redis,
    api: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}
