import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module.js';
import { KycModule } from '../../integrations/kyc/kyc.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PartiesModule } from '../parties/parties.module.js';
import { AttributionDisputeService } from './application/attribution-dispute.service.js';
import { LeadAttributionService } from './application/lead-attribution.service.js';
import { PartnerAdminService } from './application/partner-admin.service.js';
import { PartnerKycService } from './application/partner-kyc.service.js';
import { PartnerService } from './application/partner.service.js';
import { ReferralCodeService } from './application/referral-code.service.js';
import { AdminPartnersController } from './http/admin-partners.controller.js';
import { OpsAttributionDisputesController } from './http/ops-attribution-disputes.controller.js';
import { PartnerPortalController } from './http/partner-portal.controller.js';
import { PartnerSignupController } from './http/partner-signup.controller.js';
import { LeadAttributionRepository } from './infrastructure/lead-attribution.repository.js';
import { PartnerRepository } from './infrastructure/partner.repository.js';

@Module({
  imports: [AccessModule, CatalogModule, KycModule, PartiesModule],
  controllers: [PartnerSignupController, PartnerPortalController, AdminPartnersController, OpsAttributionDisputesController],
  providers: [PartnerRepository, LeadAttributionRepository, PartnerService, PartnerAdminService, LeadAttributionService, ReferralCodeService, AttributionDisputeService, PartnerKycService],
  exports: [PartnerService, LeadAttributionService, ReferralCodeService, AttributionDisputeService, PartnerKycService],
})
export class PartnersModule {}
