import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { CatalogStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class DocumentTypeRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  list(where: Prisma.DocumentTypeWhereInput) {
    return this.txHost.tx.documentType.findMany({ where, orderBy: { key: 'asc' } });
  }

  findById(id: string) {
    return this.txHost.tx.documentType.findUnique({ where: { id } });
  }

  findActiveByKeys(keys: string[]) {
    return this.txHost.tx.documentType.findMany({ where: { key: { in: keys }, status: CatalogStatus.active } });
  }

  create(data: Prisma.DocumentTypeCreateInput) {
    return this.txHost.tx.documentType.create({ data });
  }

  updateVersioned(id: string, version: number, data: Prisma.DocumentTypeUpdateManyMutationInput) {
    return this.txHost.tx.documentType.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }
}
