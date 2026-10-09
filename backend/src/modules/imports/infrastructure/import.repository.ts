import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { ImportRowStatus, ImportStatus, Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class ImportRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.ImportBatchUncheckedCreateInput) {
    return this.txHost.tx.importBatch.create({ data });
  }

  find(id: string) {
    return this.txHost.tx.importBatch.findUnique({ where: { id } });
  }

  list(where: Prisma.ImportBatchWhereInput, take: number) {
    return this.txHost.tx.importBatch.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  updateFromStatus(id: string, status: ImportStatus, data: Prisma.ImportBatchUncheckedUpdateManyInput) {
    return this.txHost.tx.importBatch.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  updateProgress(id: string, data: Prisma.ImportBatchUncheckedUpdateManyInput) {
    return this.txHost.tx.importBatch.updateMany({ where: { id }, data });
  }

  deleteRows(batchId: string) {
    return this.txHost.tx.importRow.deleteMany({ where: { batchId } });
  }

  createRows(data: Prisma.ImportRowCreateManyInput[]) {
    return this.txHost.tx.importRow.createMany({ data });
  }

  rowsAfter(batchId: string, status: ImportRowStatus, afterRowNumber: number, take: number) {
    return this.txHost.tx.importRow.findMany({ where: { batchId, status, rowNumber: { gt: afterRowNumber } }, orderBy: { rowNumber: 'asc' }, take });
  }

  updateRow(id: string, data: Prisma.ImportRowUncheckedUpdateInput) {
    return this.txHost.tx.importRow.update({ where: { id }, data });
  }

  countByStatus(batchId: string) {
    return this.txHost.tx.importRow.groupBy({ by: ['status'], where: { batchId }, _count: { status: true } });
  }

  rowsPage(batchId: string, statuses: ImportRowStatus[], take: number, idFilter?: { lt: string }) {
    return this.txHost.tx.importRow.findMany({ where: { batchId, status: { in: statuses }, id: idFilter }, orderBy: { id: 'desc' }, take });
  }
}
