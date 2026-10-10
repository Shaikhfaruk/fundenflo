import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { AttributesModule } from '../attributes/attributes.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { ConsentsModule } from '../consents/consents.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { LendersModule } from '../lenders/lenders.module.js';
import { MatchingModule } from '../matching/matching.module.js';
import { DocumentRequestService } from './application/document-request.service.js';
import { SubmissionDocumentOwner } from './application/submission-document.owner.js';
import { SubmissionNotificationService } from './application/submission-notification.service.js';
import { SubmissionPacketBuilder } from './application/submission-packet.builder.js';
import { SubmissionStatusSubscriptionTarget } from './application/submission-status-subscription.target.js';
import { SubmissionService } from './application/submission.service.js';
import { ApplicationSubmissionsController } from './http/application-submissions.controller.js';
import { LenderSubmissionsController } from './http/lender-submissions.controller.js';
import { OpsSubmissionsController } from './http/ops-submissions.controller.js';
import { SubmissionDeliverProcessor } from './infrastructure/submission-deliver.processor.js';
import { SubmissionNotifyProcessor } from './infrastructure/submission-notify.processor.js';
import { SubmissionSyncProcessor } from './infrastructure/submission-sync.processor.js';
import { SubmissionRepository } from './infrastructure/submission.repository.js';

export const SUBMISSION_PROCESSORS = [SubmissionDeliverProcessor, SubmissionNotifyProcessor, SubmissionSyncProcessor];

@Module({
  imports: [AccessModule, ApplicationsModule, AssessmentsModule, AttributesModule, AuthModule, ConfigPublishingModule, ConsentsModule, DocumentsModule, LendersModule, MatchingModule],
  controllers: [ApplicationSubmissionsController, LenderSubmissionsController, OpsSubmissionsController],
  providers: [SubmissionRepository, SubmissionPacketBuilder, DocumentRequestService, SubmissionService, SubmissionNotificationService, SubmissionDocumentOwner, SubmissionStatusSubscriptionTarget],
  exports: [SubmissionService, DocumentRequestService, SubmissionNotificationService],
})
export class SubmissionsModule {}
