import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import type { LedgerAccountSpec } from '../domain/commission.constants.js';

@Injectable()
export class LedgerRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  ensureAccount(spec: LedgerAccountSpec) {
    return this.txHost.tx.ledgerAccount.upsert({ where: { code: spec.code }, create: { code: spec.code, name: spec.name, type: spec.type, organizationId: spec.organizationId ?? null }, update: {} });
  }

  findAccount(code: string) {
    return this.txHost.tx.ledgerAccount.findUnique({ where: { code } });
  }

  createJournal(data: Prisma.LedgerJournalUncheckedCreateInput) {
    return this.txHost.tx.ledgerJournal.create({ data });
  }

  createEntries(data: Prisma.LedgerEntryCreateManyInput[]) {
    return this.txHost.tx.ledgerEntry.createMany({ data });
  }

  async balance(accountId: string, before?: Date) {
    const sums = await this.txHost.tx.ledgerEntry.aggregate({ where: { accountId, ...(before ? { createdAt: { lt: before } } : {}) }, _sum: { debitPaise: true, creditPaise: true } });
    return { debitPaise: sums._sum.debitPaise ?? 0n, creditPaise: sums._sum.creditPaise ?? 0n };
  }

  balances() {
    return this.txHost.tx.ledgerEntry.groupBy({ by: ['accountId'], _sum: { debitPaise: true, creditPaise: true } });
  }

  accounts(ids: string[]) {
    return this.txHost.tx.ledgerAccount.findMany({ where: { id: { in: ids } } });
  }

  entries(accountId: string, idFilter: Prisma.UuidFilter | undefined, take: number) {
    return this.txHost.tx.ledgerEntry.findMany({ where: { accountId, id: idFilter }, orderBy: { id: 'desc' }, take, include: { journal: true } });
  }
}
