import 'server-only';

import { z } from 'zod';

const serverEnvSchema = z.object({
  API_ORIGIN: z.url().default('http://localhost:3000'),
  APP_ORIGIN: z.url().default('http://localhost:3100'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const serverEnv = serverEnvSchema.parse({
  API_ORIGIN: process.env.API_ORIGIN,
  APP_ORIGIN: process.env.APP_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
});

export const secureCookies = serverEnv.NODE_ENV === 'production';
