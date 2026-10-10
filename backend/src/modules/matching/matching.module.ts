import { Module } from '@nestjs/common';

import { ApplicationsModule } from '../applications/applications.module.js';
import { AttributesModule } from '../attributes/attributes.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { LendersModule } from '../lenders/lenders.module.js';
import { MatchingService } from './application/matching.service.js';
import { ApplicationMatchesController } from './http/application-matches.controller.js';
import { MatchingRunProcessor } from './infrastructure/matching-run.processor.js';
import { MatchingRepository } from './infrastructure/matching.repository.js';

export const MATCHING_PROCESSORS = [MatchingRunProcessor];

@Module({
  imports: [ApplicationsModule, AttributesModule, ConfigPublishingModule, DocumentsModule, LendersModule],
  controllers: [ApplicationMatchesController],
  providers: [MatchingRepository, MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
