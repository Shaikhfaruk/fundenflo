import '../bootstrap/load-env.js';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { FieldCipher } from '../infrastructure/crypto/field-cipher.service.js';
import { FieldKeyRotation } from '../infrastructure/crypto/field-key-rotation.service.js';
import { ScriptModule } from './script.module.js';

const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
try {
  const rotation = app.get(FieldKeyRotation);
  const run = await rotation.rotate(Number.POSITIVE_INFINITY);
  process.stdout.write(`Re-encrypted ${run.rotated} values with data key ${app.get(FieldCipher).activeKeyId}; ${run.failed} could not be read.\n`);
  const left = (await rotation.backlog()).filter((row) => row.rows > 0);
  for (const row of left) process.stdout.write(`${row.table}.${row.column}: ${row.rows} values still on an older key\n`);
  if (left.length === 0) process.stdout.write('Every encrypted value uses the active key. Older keys can be removed from the key ring.\n');
  process.exitCode = left.length === 0 ? 0 : 1;
} finally {
  await app.close();
}
