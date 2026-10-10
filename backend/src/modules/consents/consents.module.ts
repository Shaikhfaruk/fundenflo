import { Module } from '@nestjs/common';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { AccessModule } from '../access/access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { PartiesModule } from '../parties/parties.module.js';
import { ConsentMergeParticipant } from './application/consent-merge.participant.js';
import { ConsentOtpService } from './application/consent-otp.service.js';
import { ConsentPurposeService } from './application/consent-purpose.service.js';
import { ConsentRequestService } from './application/consent-request.service.js';
import { ConsentTemplateHandler } from './application/consent-template.handler.js';
import { ConsentService } from './application/consent.service.js';
import { AdminConsentPurposesController } from './http/admin-consent-purposes.controller.js';
import { CatalogConsentTemplatesController } from './http/catalog-consent-templates.controller.js';
import { MeConsentsController } from './http/me-consents.controller.js';
import { OpsConsentsController } from './http/ops-consents.controller.js';
import { PublicConsentRequestsController } from './http/public-consent-requests.controller.js';
import { ConsentRepository } from './infrastructure/consent.repository.js';
import { ConsentPrivacyParticipant } from './application/consent-privacy.participant.js';

const AdminConsentTemplatesController = createVersionedConfigController({
  resource: ConfigResource.consent_template,
  path: 'consent-templates',
  name: 'AdminConsentTemplatesController',
});

@Module({
  imports: [AccessModule, AuthModule, ConfigPublishingModule, PartiesModule],
  controllers: [AdminConsentPurposesController, AdminConsentTemplatesController, CatalogConsentTemplatesController, MeConsentsController, OpsConsentsController, PublicConsentRequestsController],
  providers: [ConsentPrivacyParticipant, ConsentMergeParticipant, ConsentRepository, ConsentPurposeService, ConsentTemplateHandler, ConsentService, ConsentRequestService, ConsentOtpService],
  exports: [ConsentService, ConsentRequestService, ConsentOtpService],
})
export class ConsentsModule {}
