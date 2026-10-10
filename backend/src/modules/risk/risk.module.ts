import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { PartnersModule } from '../partners/partners.module.js';
import { RiskDetectionService } from './application/risk-detection.service.js';
import { RiskService } from './application/risk.service.js';
import { OpsRiskController } from './http/ops-risk.controller.js';
import { RiskDetectProcessor } from './infrastructure/risk-detect.processor.js';
import { RiskRepository } from './infrastructure/risk.repository.js';

export const RISK_PROCESSORS = [RiskDetectProcessor];

@Module({
  imports: [DocumentsModule, PartnersModule],
  controllers: [OpsRiskController],
  providers: [RiskRepository, RiskService, RiskDetectionService],
  exports: [RiskService, RiskDetectionService],
})
export class RiskModule {}
