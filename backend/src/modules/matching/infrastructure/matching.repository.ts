import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class MatchingRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  createRun(data: Prisma.MatchRunUncheckedCreateInput) {
    return this.txHost.tx.matchRun.create({ data });
  }

  createResults(data: Prisma.MatchResultCreateManyInput[]) {
    return this.txHost.tx.matchResult.createMany({ data });
  }

  latestRun(applicationId: string) {
    return this.txHost.tx.matchRun.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' }, include: { results: { orderBy: { rank: 'asc' } } } });
  }

  findResult(id: string) {
    return this.txHost.tx.matchResult.findUnique({ where: { id } });
  }
}
