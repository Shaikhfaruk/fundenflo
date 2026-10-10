import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class AnswerRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  createMany(data: Prisma.AnswerCreateManyInput[]) {
    return this.txHost.tx.answer.createManyAndReturn({ data });
  }

  listForParty(partyId: string, questionKey: string | undefined, take: number, idFilter?: { lt: string }) {
    return this.txHost.tx.answer.findMany({ where: { partyId, questionKey, id: idFilter }, orderBy: { id: 'desc' }, take });
  }

  async answerIdsOfParty(partyId: string) {
    return (await this.txHost.tx.answer.findMany({ where: { partyId }, select: { id: true } })).map((row) => row.id);
  }

  moveAnswers(ids: string[], partyId: string) {
    return this.txHost.tx.answer.updateMany({ where: { id: { in: ids } }, data: { partyId } });
  }
}
