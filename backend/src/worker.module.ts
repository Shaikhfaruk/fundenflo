import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { AuthorizationModule } from './modules/access/authorization.module.js';
import { APPLICATION_PROCESSORS, ApplicationsModule } from './modules/applications/applications.module.js';
import { MaintenanceProcessor } from './infrastructure/maintenance/maintenance.processor.js';
import { OutboxRelayProcessor } from './infrastructure/outbox/outbox-relay.processor.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { DOCUMENT_PROCESSORS, DocumentsModule } from './modules/documents/documents.module.js';
import { IMPORT_PROCESSORS, ImportsModule } from './modules/imports/imports.module.js';
import { ASSESSMENT_PROCESSORS, AssessmentsModule } from './modules/assessments/assessments.module.js';
import { LendersModule } from './modules/lenders/lenders.module.js';
import { MATCHING_PROCESSORS, MatchingModule } from './modules/matching/matching.module.js';
import { SUBSCRIPTION_PROCESSORS, SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { LEAD_PROCESSORS, LeadsModule } from './modules/leads/leads.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { SLA_PROCESSORS, SlaModule } from './modules/sla/sla.module.js';
import { SessionRevocationProcessor } from './modules/auth/infrastructure/session-revocation.processor.js';
import { SessionsModule } from './modules/auth/sessions.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { WorkerScheduler } from './worker-scheduler.service.js';

@Module({
  imports: [
    InfrastructureModule.forRoot({ processName: 'worker' }),
    AuditModule.forRoot({ http: false }),
    AuthorizationModule,
    NotificationsModule.forRoot({ worker: true }),
    DiscoveryModule,
    SessionsModule,
    SlaModule,
    RealtimeModule.forRoot({ worker: true }),
    LeadsModule,
    ImportsModule,
    DocumentsModule,
    ApplicationsModule,
    LendersModule,
    AssessmentsModule,
    SubscriptionsModule,
    MatchingModule,
  ],
  providers: [OutboxRelayProcessor, SessionRevocationProcessor, MaintenanceProcessor, WorkerScheduler, ...LEAD_PROCESSORS, ...IMPORT_PROCESSORS, ...SLA_PROCESSORS, ...DOCUMENT_PROCESSORS, ...APPLICATION_PROCESSORS, ...ASSESSMENT_PROCESSORS, ...SUBSCRIPTION_PROCESSORS, ...MATCHING_PROCESSORS],
})
export class WorkerModule {}
