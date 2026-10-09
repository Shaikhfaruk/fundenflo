import { Module } from '@nestjs/common';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { AccessModule } from '../access/access.module.js';
import { AttributesModule } from '../attributes/attributes.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { ConsentsModule } from '../consents/consents.module.js';
import { PartiesModule } from '../parties/parties.module.js';
import { PartnersModule } from '../partners/partners.module.js';
import { QuestionnairesModule } from '../questionnaires/questionnaires.module.js';
import { LeadAssignmentService } from './application/lead-assignment.service.js';
import { LeadCaptureService } from './application/lead-capture.service.js';
import { LeadConsentPolicy } from './application/lead-consent.policy.js';
import { LeadImportHandler } from './application/lead-import.handler.js';
import { LeadLocator } from './application/lead-locator.service.js';
import { LeadRoutingService } from './application/lead-routing.service.js';
import { LeadSourceService } from './application/lead-source.service.js';
import { LeadTimeline } from './application/lead-timeline.service.js';
import { LeadService } from './application/lead.service.js';
import { PartnerLeadService } from './application/partner-lead.service.js';
import { RoutingRuleHandler } from './application/routing-rule.handler.js';
import { AdminLeadSourcesController } from './http/admin-lead-sources.controller.js';
import { AdminRoutingSimulateController } from './http/admin-routing-simulate.controller.js';
import { OpsLeadsController } from './http/ops-leads.controller.js';
import { PartnerLeadsController } from './http/partner-leads.controller.js';
import { PublicLeadsController } from './http/public-leads.controller.js';
import { LeadConsentSyncProcessor } from './infrastructure/lead-consent-sync.processor.js';
import { LeadDropoffProcessor } from './infrastructure/lead-dropoff.processor.js';
import { LeadRoutingProcessor } from './infrastructure/lead-routing.processor.js';
import { LeadRoutingQueue } from './infrastructure/lead-routing.queue.js';
import { LeadRepository } from './infrastructure/lead.repository.js';

const AdminRoutingRulesController = createVersionedConfigController({ resource: ConfigResource.routing_rule, path: 'routing-rules', name: 'AdminRoutingRulesController' });

@Module({
  imports: [AccessModule, AttributesModule, CatalogModule, ConfigPublishingModule, ConsentsModule, PartiesModule, PartnersModule, QuestionnairesModule],
  controllers: [AdminLeadSourcesController, AdminRoutingSimulateController, AdminRoutingRulesController, OpsLeadsController, PartnerLeadsController, PublicLeadsController],
  providers: [
    LeadRepository,
    LeadRoutingQueue,
    LeadTimeline,
    LeadLocator,
    LeadConsentPolicy,
    LeadSourceService,
    LeadCaptureService,
    LeadAssignmentService,
    LeadService,
    LeadImportHandler,
    RoutingRuleHandler,
    LeadRoutingService,
    PartnerLeadService,
  ],
  exports: [LeadAssignmentService, LeadCaptureService, LeadRoutingService, LeadService, LeadSourceService],
})
export class LeadsModule {}

export const LEAD_PROCESSORS = [LeadConsentSyncProcessor, LeadDropoffProcessor, LeadRoutingProcessor];
