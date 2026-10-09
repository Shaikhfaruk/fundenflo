import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node dist/scripts/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
