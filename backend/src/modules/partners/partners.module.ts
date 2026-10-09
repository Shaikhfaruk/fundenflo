import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PartnerAdminService } from './application/partner-admin.service.js';
import { PartnerService } from './application/partner.service.js';
import { AdminPartnersController } from './http/admin-partners.controller.js';
import { PartnerPortalController } from './http/partner-portal.controller.js';
import { PartnerSignupController } from './http/partner-signup.controller.js';
import { PartnerRepository } from './infrastructure/partner.repository.js';

@Module({
  imports: [AccessModule, CatalogModule],
  controllers: [PartnerSignupController, PartnerPortalController, AdminPartnersController],
  providers: [PartnerRepository, PartnerService, PartnerAdminService],
  exports: [PartnerService],
})
export class PartnersModule {}
