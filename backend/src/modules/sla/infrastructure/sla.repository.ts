import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { SlaTimerStatus } from '../../../common/enums/db.enums.js';
import type { Prisma, SlaTimer } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class SlaRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.SlaTimerUncheckedCreateInput) {
    return this.txHost.tx.slaTimer.create({ data });
  }

  closePending(where: Prisma.SlaTimerWhereInput, data: Prisma.SlaTimerUncheckedUpdateManyInput) {
    return this.txHost.tx.slaTimer.updateMany({ where: { ...where, status: SlaTimerStatus.pending }, data: { ...data, version: { increment: 1 } } });
  }

  findDueIds(now: Date, take: number) {
    return this.txHost.tx.slaTimer.findMany({
      where: { status: SlaTimerStatus.pending, OR: [{ dueAt: { lte: now } }, { warnAt: { lte: now }, warnedAt: null }] },
      select: { id: true },
      orderBy: { dueAt: 'asc' },
      take,
    });
  }

  async claim(id: string): Promise<SlaTimer | null> {
    const rows = await this.txHost.tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM sla_timers WHERE id = ${id}::uuid AND status = 'pending' FOR UPDATE SKIP LOCKED`;
    return rows.length === 0 ? null : this.txHost.tx.slaTimer.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.SlaTimerUncheckedUpdateInput) {
    return this.txHost.tx.slaTimer.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  listForEntity(entityType: string, entityIds: string[]) {
    return this.txHost.tx.slaTimer.findMany({ where: { entityType, entityId: { in: entityIds } }, orderBy: { createdAt: 'asc' } });
  }
}
