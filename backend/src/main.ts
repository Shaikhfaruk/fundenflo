import './bootstrap/load-env.js';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureHttpApp } from './bootstrap/configure-http-app.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
const config = configureHttpApp(app);
await app.listen(config.PORT);
