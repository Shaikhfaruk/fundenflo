import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class ActivityRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  createActivity(data: Prisma.ActivityUncheckedCreateInput) {
    return this.txHost.tx.activity.create({ data });
  }

  listActivities(where: Prisma.ActivityWhereInput, take: number) {
    return this.txHost.tx.activity.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  createFollowUp(data: Prisma.FollowUpUncheckedCreateInput) {
    return this.txHost.tx.followUp.create({ data });
  }

  findFollowUp(where: Prisma.FollowUpWhereInput) {
    return this.txHost.tx.followUp.findFirst({ where });
  }

  listFollowUps(where: Prisma.FollowUpWhereInput, take: number) {
    return this.txHost.tx.followUp.findMany({ where, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take });
  }

  updateFollowUps(where: Prisma.FollowUpWhereInput, data: Prisma.FollowUpUncheckedUpdateManyInput) {
    return this.txHost.tx.followUp.updateMany({ where, data: { ...data, version: { increment: 1 } } });
  }

  updateFollowUpVersioned(id: string, version: number, data: Prisma.FollowUpUncheckedUpdateManyInput) {
    return this.txHost.tx.followUp.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }
}
