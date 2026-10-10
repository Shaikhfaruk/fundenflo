import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { PayoutStatus, Prisma, ReceivableStatus } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class CommissionRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  createReceivable(data: Prisma.ReceivableUncheckedCreateInput) {
    return this.txHost.tx.receivable.create({ data });
  }

  findReceivable(where: Prisma.ReceivableWhereInput) {
    return this.txHost.tx.receivable.findFirst({ where, include: { payouts: true } });
  }

  listReceivables(where: Prisma.ReceivableWhereInput, take: number) {
    return this.txHost.tx.receivable.findMany({ where, orderBy: { id: 'desc' }, take, include: { payouts: true } });
  }

  async lockReceivable(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM receivables WHERE id = ${id}::uuid FOR UPDATE`;
  }

  updateReceivableFromStatus(id: string, status: ReceivableStatus, data: Prisma.ReceivableUncheckedUpdateManyInput) {
    return this.txHost.tx.receivable.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  createPayout(data: Prisma.PartnerPayoutUncheckedCreateInput) {
    return this.txHost.tx.partnerPayout.create({ data });
  }

  findPayout(where: Prisma.PartnerPayoutWhereInput) {
    return this.txHost.tx.partnerPayout.findFirst({ where, include: { receivable: true } });
  }

  listPayouts(where: Prisma.PartnerPayoutWhereInput, take: number) {
    return this.txHost.tx.partnerPayout.findMany({ where, orderBy: { id: 'desc' }, take, include: { receivable: true } });
  }

  async lockPayout(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM partner_payouts WHERE id = ${id}::uuid FOR UPDATE`;
  }

  updatePayoutFromStatus(id: string, status: PayoutStatus, data: Prisma.PartnerPayoutUncheckedUpdateManyInput) {
    return this.txHost.tx.partnerPayout.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  payoutTotals(where: Prisma.PartnerPayoutWhereInput) {
    return this.txHost.tx.partnerPayout.groupBy({ by: ['status'], where, _sum: { grossPaise: true, tdsPaise: true, netPaise: true }, _count: { id: true } });
  }

  linkRun(receivableId: string, reconciliationRunId: string) {
    return this.txHost.tx.receivable.updateMany({ where: { id: receivableId }, data: { reconciliationRunId, version: { increment: 1 } } });
  }

  createRun(data: Prisma.ReconciliationRunUncheckedCreateInput) {
    return this.txHost.tx.reconciliationRun.create({ data });
  }

  listRuns(where: Prisma.ReconciliationRunWhereInput, take: number) {
    return this.txHost.tx.reconciliationRun.findMany({ where, orderBy: { id: 'desc' }, take });
  }
}
