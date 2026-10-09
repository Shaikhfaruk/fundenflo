import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import type { PrismaService } from './prisma.service.js';

export type PrismaTx = TransactionalAdapterPrisma<PrismaService>;
