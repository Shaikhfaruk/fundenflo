import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class FactRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  createMany(data: Prisma.BorrowerFactCreateManyInput[]) {
    return this.txHost.tx.borrowerFact.createManyAndReturn({ data });
  }

  listForParty(partyId: string, attributeKeys?: string[]) {
    return this.txHost.tx.borrowerFact.findMany({
      where: { partyId, ...(attributeKeys ? { attributeKey: { in: attributeKeys } } : {}) },
      orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
    });
  }

  history(partyId: string, attributeKey: string | undefined, take: number, idFilter?: { lt: string }) {
    return this.txHost.tx.borrowerFact.findMany({
      where: { partyId, attributeKey, id: idFilter },
      orderBy: { id: 'desc' },
      take,
    });
  }

  async factIdsOfParty(partyId: string) {
    return (await this.txHost.tx.borrowerFact.findMany({ where: { partyId }, select: { id: true } })).map((row) => row.id);
  }

  moveFacts(ids: string[], partyId: string) {
    return this.txHost.tx.borrowerFact.updateMany({ where: { id: { in: ids } }, data: { partyId } });
  }
}
