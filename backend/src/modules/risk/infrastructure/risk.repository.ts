import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { FraudReviewStatus, RiskSignalStatus } from '../../../common/enums/db.enums.js';
import type { Prisma, RiskSubjectType } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class RiskRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  findOpenSignal(fingerprint: string) {
    return this.txHost.tx.riskSignal.findFirst({ where: { fingerprint, status: RiskSignalStatus.open } });
  }

  createSignal(data: Prisma.RiskSignalUncheckedCreateInput) {
    return this.txHost.tx.riskSignal.create({ data });
  }

  listSignals(where: Prisma.RiskSignalWhereInput, take: number) {
    return this.txHost.tx.riskSignal.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  updateSignalsOfReview(reviewId: string, status: RiskSignalStatus) {
    return this.txHost.tx.riskSignal.updateMany({ where: { reviewId, status: RiskSignalStatus.open }, data: { status } });
  }

  findOpenReview(subjectType: RiskSubjectType, subjectId: string) {
    return this.txHost.tx.fraudReview.findFirst({ where: { subjectType, subjectId, status: FraudReviewStatus.open } });
  }

  createReview(data: Prisma.FraudReviewUncheckedCreateInput) {
    return this.txHost.tx.fraudReview.create({ data });
  }

  updateReview(id: string, status: FraudReviewStatus, data: Prisma.FraudReviewUncheckedUpdateManyInput) {
    return this.txHost.tx.fraudReview.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  async lockReview(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM fraud_reviews WHERE id = ${id}::uuid FOR UPDATE`;
  }

  findReview(where: Prisma.FraudReviewWhereInput, signalsLimit: number) {
    return this.txHost.tx.fraudReview.findFirst({ where, include: { signals: { orderBy: { createdAt: 'asc' }, take: signalsLimit } } });
  }

  listReviews(where: Prisma.FraudReviewWhereInput, take: number) {
    return this.txHost.tx.fraudReview.findMany({ where, orderBy: { id: 'desc' }, take });
  }
}
