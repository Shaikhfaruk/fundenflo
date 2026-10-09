import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConsentsModule } from '../consents/consents.module.js';
import { PartiesModule } from '../parties/parties.module.js';
import { QuestionnairesModule } from '../questionnaires/questionnaires.module.js';
import { LeadCaptureService } from './application/lead-capture.service.js';
import { LeadConsentPolicy } from './application/lead-consent.policy.js';
import { LeadImportHandler } from './application/lead-import.handler.js';
import { LeadLocator } from './application/lead-locator.service.js';
import { LeadSourceService } from './application/lead-source.service.js';
import { LeadTimeline } from './application/lead-timeline.service.js';
import { LeadService } from './application/lead.service.js';
import { AdminLeadSourcesController } from './http/admin-lead-sources.controller.js';
import { OpsLeadsController } from './http/ops-leads.controller.js';
import { PublicLeadsController } from './http/public-leads.controller.js';
import { LeadConsentSyncProcessor } from './infrastructure/lead-consent-sync.processor.js';
import { LeadDropoffProcessor } from './infrastructure/lead-dropoff.processor.js';
import { LeadRepository } from './infrastructure/lead.repository.js';

@Module({
  imports: [AccessModule, CatalogModule, ConsentsModule, PartiesModule, QuestionnairesModule],
  controllers: [AdminLeadSourcesController, OpsLeadsController, PublicLeadsController],
  providers: [LeadRepository, LeadTimeline, LeadLocator, LeadConsentPolicy, LeadSourceService, LeadCaptureService, LeadService, LeadImportHandler],
  exports: [LeadCaptureService, LeadService, LeadSourceService],
})
export class LeadsModule {}

export const LEAD_PROCESSORS = [LeadConsentSyncProcessor, LeadDropoffProcessor];
