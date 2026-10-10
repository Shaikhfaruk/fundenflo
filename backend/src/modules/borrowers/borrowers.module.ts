import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PartiesModule } from '../parties/parties.module.js';
import { BorrowerMergeParticipant } from './application/borrower-merge.participant.js';
import { BorrowerProfileDocumentOwner } from './application/borrower-profile-document.owner.js';
import { BorrowerProfileService } from './application/borrower-profile.service.js';
import { BorrowerProfilesController } from './http/borrower-profiles.controller.js';
import { BorrowerProfileRepository } from './infrastructure/borrower-profile.repository.js';

@Module({
  imports: [AuthModule, CatalogModule, PartiesModule],
  controllers: [BorrowerProfilesController],
  providers: [BorrowerProfileRepository, BorrowerProfileService, BorrowerProfileDocumentOwner, BorrowerMergeParticipant],
  exports: [BorrowerProfileService],
})
export class BorrowersModule {}
