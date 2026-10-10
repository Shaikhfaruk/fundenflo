import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { BorrowersModule } from '../borrowers/borrowers.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConsentsModule } from '../consents/consents.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { LeadsModule } from '../leads/leads.module.js';
import { QuestionnairesModule } from '../questionnaires/questionnaires.module.js';
import { ApplicationDocumentOwner } from './application/application-document.owner.js';
import { ApplicationMergeParticipant } from './application/application-merge.participant.js';
import { ApplicationTimeline } from './application/application-timeline.service.js';
import { ApplicationService } from './application/application.service.js';
import { ApplicationsController } from './http/applications.controller.js';
import { ApplicationRefreshProcessor } from './infrastructure/application-refresh.processor.js';
import { ApplicationRepository } from './infrastructure/application.repository.js';

export const APPLICATION_PROCESSORS = [ApplicationRefreshProcessor];

@Module({
  imports: [AuthModule, BorrowersModule, CatalogModule, ConsentsModule, DocumentsModule, LeadsModule, QuestionnairesModule],
  controllers: [ApplicationsController],
  providers: [ApplicationRepository, ApplicationTimeline, ApplicationService, ApplicationDocumentOwner, ApplicationMergeParticipant],
  exports: [ApplicationService],
})
export class ApplicationsModule {}
