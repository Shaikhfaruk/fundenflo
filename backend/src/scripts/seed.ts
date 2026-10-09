import '../bootstrap/load-env.js';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';
import { runSeed } from './seed-data/run-seed.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }) });

try {
  const result = await runSeed(prisma, process.env);
  process.stdout.write(`Seeded FundenFlo organization ${result.organizationId} and ${result.templates} notification templates\n`);
} finally {
  await prisma.$disconnect();
}
