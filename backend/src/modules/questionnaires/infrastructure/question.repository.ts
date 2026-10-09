import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class QuestionRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  list(where: Prisma.QuestionWhereInput) {
    return this.txHost.tx.question.findMany({ where, orderBy: { key: 'asc' } });
  }

  findById(id: string) {
    return this.txHost.tx.question.findUnique({ where: { id } });
  }

  findByKeys(keys: string[]) {
    return this.txHost.tx.question.findMany({ where: { key: { in: keys } } });
  }

  create(data: Prisma.QuestionUncheckedCreateInput) {
    return this.txHost.tx.question.create({ data });
  }

  updateVersioned(id: string, version: number, data: Prisma.QuestionUpdateManyMutationInput) {
    return this.txHost.tx.question.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }
}
