import { Module } from '@nestjs/common';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { AccessModule } from '../access/access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { PartiesModule } from '../parties/parties.module.js';
import { ConsentPurposeService } from './application/consent-purpose.service.js';
import { ConsentTemplateHandler } from './application/consent-template.handler.js';
import { ConsentService } from './application/consent.service.js';
import { AdminConsentPurposesController } from './http/admin-consent-purposes.controller.js';
import { CatalogConsentTemplatesController } from './http/catalog-consent-templates.controller.js';
import { MeConsentsController } from './http/me-consents.controller.js';
import { OpsConsentsController } from './http/ops-consents.controller.js';
import { ConsentRepository } from './infrastructure/consent.repository.js';

const AdminConsentTemplatesController = createVersionedConfigController({
  resource: ConfigResource.consent_template,
  path: 'consent-templates',
  name: 'AdminConsentTemplatesController',
});

@Module({
  imports: [AccessModule, AuthModule, ConfigPublishingModule, PartiesModule],
  controllers: [AdminConsentPurposesController, AdminConsentTemplatesController, CatalogConsentTemplatesController, MeConsentsController, OpsConsentsController],
  providers: [ConsentRepository, ConsentPurposeService, ConsentTemplateHandler, ConsentService],
  exports: [ConsentService],
})
export class ConsentsModule {}
