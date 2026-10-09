import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { AuthorizationModule } from './modules/access/authorization.module.js';
import { MaintenanceProcessor } from './infrastructure/maintenance/maintenance.processor.js';
import { OutboxRelayProcessor } from './infrastructure/outbox/outbox-relay.processor.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { IMPORT_PROCESSORS, ImportsModule } from './modules/imports/imports.module.js';
import { LEAD_PROCESSORS, LeadsModule } from './modules/leads/leads.module.js';
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
    LeadsModule,
    ImportsModule,
  ],
  providers: [OutboxRelayProcessor, SessionRevocationProcessor, MaintenanceProcessor, WorkerScheduler, ...LEAD_PROCESSORS, ...IMPORT_PROCESSORS],
})
export class WorkerModule {}
