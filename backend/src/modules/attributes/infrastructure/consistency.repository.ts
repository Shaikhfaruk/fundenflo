import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { FactProvenance } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class ConsistencyRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  latestDeclared(partyId: string, attributeKeys: string[]) {
    return this.txHost.tx.borrowerFact.findMany({ where: { partyId, attributeKey: { in: attributeKeys }, provenance: FactProvenance.declared }, orderBy: [{ observedAt: 'desc' }, { id: 'desc' }] });
  }

  createSignals(data: Prisma.ConsistencySignalCreateManyInput[]) {
    return this.txHost.tx.consistencySignal.createManyAndReturn({ data, skipDuplicates: true });
  }

  list(where: Prisma.ConsistencySignalWhereInput, take: number) {
    return this.txHost.tx.consistencySignal.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  find(id: string) {
    return this.txHost.tx.consistencySignal.findUnique({ where: { id } });
  }

  async idsOfParty(partyId: string) {
    return (await this.txHost.tx.consistencySignal.findMany({ where: { partyId }, select: { id: true } })).map((row) => row.id);
  }

  async moveParty(ids: string[], partyId: string) {
    await this.txHost.tx.consistencySignal.updateMany({ where: { id: { in: ids } }, data: { partyId, version: { increment: 1 } } });
  }

  updateFromStatus(id: string, status: Prisma.ConsistencySignalWhereInput['status'], data: Prisma.ConsistencySignalUncheckedUpdateManyInput) {
    return this.txHost.tx.consistencySignal.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }
}
