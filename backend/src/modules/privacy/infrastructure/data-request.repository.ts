import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { DataRequestStatus, Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class DataRequestRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.DataSubjectRequestUncheckedCreateInput) {
    return this.txHost.tx.dataSubjectRequest.create({ data });
  }

  findOne(where: Prisma.DataSubjectRequestWhereInput) {
    return this.txHost.tx.dataSubjectRequest.findFirst({ where });
  }

  list(where: Prisma.DataSubjectRequestWhereInput, take: number) {
    return this.txHost.tx.dataSubjectRequest.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  async lock(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM data_subject_requests WHERE id = ${id}::uuid FOR UPDATE`;
  }

  updateFromStatus(id: string, status: DataRequestStatus, data: Prisma.DataSubjectRequestUncheckedUpdateManyInput) {
    return this.txHost.tx.dataSubjectRequest.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  expiredExports(now: Date, take: number) {
    return this.txHost.tx.dataSubjectRequest.findMany({ where: { exportExpiresAt: { lt: now }, exportStorageKey: { not: null } }, select: { id: true, exportStorageKey: true }, take });
  }

  clearExport(id: string) {
    return this.txHost.tx.dataSubjectRequest.updateMany({ where: { id }, data: { exportStorageKey: null, exportExpiresAt: null, version: { increment: 1 } } });
  }
}
