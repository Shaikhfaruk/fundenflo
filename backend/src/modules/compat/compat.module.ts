import { Module } from '@nestjs/common';

import { ApplicationsModule } from '../applications/applications.module.js';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BorrowersModule } from '../borrowers/borrowers.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConsentsModule } from '../consents/consents.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { DocumentUploadMulterModule } from '../documents/infrastructure/document-upload.multer.js';
import { LendersModule } from '../lenders/lenders.module.js';
import { MatchingModule } from '../matching/matching.module.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { CompatAuthService } from './application/compat-auth.service.js';
import { CompatJourneyService } from './application/compat-journey.service.js';
import { CompatAuthController } from './http/compat-auth.controller.js';
import { CompatJourneyController } from './http/compat-journey.controller.js';

@Module({
  imports: [ApplicationsModule, AssessmentsModule, AuthModule, BorrowersModule, CatalogModule, ConsentsModule, DocumentsModule, DocumentUploadMulterModule, LendersModule, MatchingModule, SubmissionsModule, SubscriptionsModule],
  controllers: [CompatAuthController, CompatJourneyController],
  providers: [CompatAuthService, CompatJourneyService],
})
export class CompatModule {}
