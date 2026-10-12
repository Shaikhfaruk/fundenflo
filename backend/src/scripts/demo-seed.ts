import '../bootstrap/load-env.js';
import 'reflect-metadata';

import { parseArgs } from 'node:util';

import { NestFactory } from '@nestjs/core';

import { normaliseEmail } from '../engines/party-matching/normalise.js';
import { DemoSeedModule } from './demo-seed.module.js';
import { runDemoSeed } from './seed-data/run-demo-seed.js';

const { values } = parseArgs({ options: { 'admin-email': { type: 'string' }, 'lender-email': { type: 'string' }, 'staff-domain': { type: 'string' } } });
const adminEmail = normaliseEmail(values['admin-email'] ?? '');
if (!adminEmail) {
  process.stderr.write('Usage: pnpm demo:seed --admin-email <super admin email> [--lender-email <lender user email>] [--staff-domain <domain>]\n');
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(DemoSeedModule, { logger: ['error', 'warn'] });
try {
  const report = await runDemoSeed(app, { adminEmail, lenderEmail: values['lender-email'] ? normaliseEmail(values['lender-email']) : null, staffDomain: values['staff-domain'] ?? adminEmail.split('@')[1] ?? '' });
  process.stdout.write(`\nDemo data ready:\n${report.join('\n')}\n`);
} catch (error) {
  process.stderr.write(`Demo seed stopped: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await app.close();
}
