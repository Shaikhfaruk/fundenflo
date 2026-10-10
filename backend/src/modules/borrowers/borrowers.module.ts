import { Module } from '@nestjs/common';

import { KycModule } from '../../integrations/kyc/kyc.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { LeadsModule } from '../leads/leads.module.js';
import { PartiesModule } from '../parties/parties.module.js';
import { BorrowerKycService } from './application/borrower-kyc.service.js';
import { BorrowerMergeParticipant } from './application/borrower-merge.participant.js';
import { BorrowerProfileDocumentOwner } from './application/borrower-profile-document.owner.js';
import { BorrowerProfileService } from './application/borrower-profile.service.js';
import { PartnerBorrowerService } from './application/partner-borrower.service.js';
import { BorrowerProfilesController } from './http/borrower-profiles.controller.js';
import { PartnerBorrowersController } from './http/partner-borrowers.controller.js';
import { BorrowerProfileRepository } from './infrastructure/borrower-profile.repository.js';
import { BorrowerPrivacyParticipant } from './application/borrower-privacy.participant.js';

@Module({
  imports: [AuthModule, CatalogModule, KycModule, LeadsModule, PartiesModule],
  controllers: [BorrowerProfilesController, PartnerBorrowersController],
  providers: [BorrowerPrivacyParticipant, BorrowerProfileRepository, BorrowerProfileService, BorrowerKycService, PartnerBorrowerService, BorrowerProfileDocumentOwner, BorrowerMergeParticipant],
  exports: [BorrowerProfileService, BorrowerKycService],
})
export class BorrowersModule {}
