import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class AttributeRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  list(where: Prisma.AttributeDefinitionWhereInput) {
    return this.txHost.tx.attributeDefinition.findMany({ where, orderBy: { key: 'asc' } });
  }

  findById(id: string) {
    return this.txHost.tx.attributeDefinition.findUnique({ where: { id } });
  }

  create(data: Prisma.AttributeDefinitionCreateInput) {
    return this.txHost.tx.attributeDefinition.create({ data });
  }

  updateVersioned(id: string, version: number, data: Prisma.AttributeDefinitionUpdateManyMutationInput) {
    return this.txHost.tx.attributeDefinition.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }
}
