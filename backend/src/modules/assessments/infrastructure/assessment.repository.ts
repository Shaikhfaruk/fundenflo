import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { AnalysisStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class AssessmentRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  createAnalysis(data: Prisma.AnalysisUncheckedCreateInput) {
    return this.txHost.tx.analysis.create({ data });
  }

  findAnalysis(id: string) {
    return this.txHost.tx.analysis.findUnique({ where: { id } });
  }

  openAnalysis(applicationId: string) {
    return this.txHost.tx.analysis.findFirst({ where: { applicationId, status: { in: [AnalysisStatus.queued, AnalysisStatus.running] } } });
  }

  async lockAnalysis(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM analyses WHERE id = ${id}::uuid FOR UPDATE`;
  }

  updateAnalysis(id: string, data: Prisma.AnalysisUncheckedUpdateManyInput) {
    return this.txHost.tx.analysis.updateMany({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  createScoreResult(data: Prisma.ScoreResultUncheckedCreateInput) {
    return this.txHost.tx.scoreResult.create({ data });
  }

  createImprovementItems(data: Prisma.ImprovementItemCreateManyInput[]) {
    return this.txHost.tx.improvementItem.createMany({ data });
  }

  findScoreResult(id: string) {
    return this.txHost.tx.scoreResult.findUnique({ where: { id }, include: { items: { orderBy: [{ priority: 'asc' }, { ruleKey: 'asc' }] }, analysis: { select: { id: true, documentIds: true } } } });
  }

  latestScoreResult(applicationId: string) {
    return this.txHost.tx.scoreResult.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' }, include: { items: { orderBy: [{ priority: 'asc' }, { ruleKey: 'asc' }] }, analysis: { select: { id: true, documentIds: true } } } });
  }
}
