import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { MaintenanceProcessor } from './infrastructure/maintenance/maintenance.processor.js';
import { OutboxRelayProcessor } from './infrastructure/outbox/outbox-relay.processor.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { SessionRevocationProcessor } from './modules/auth/infrastructure/session-revocation.processor.js';
import { SessionsModule } from './modules/auth/sessions.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { WorkerScheduler } from './worker-scheduler.service.js';

@Module({
  imports: [
    InfrastructureModule.forRoot({ processName: 'worker' }),
    AuditModule.forRoot({ http: false }),
    NotificationsModule.forRoot({ worker: true }),
    DiscoveryModule,
    SessionsModule,
  ],
  providers: [OutboxRelayProcessor, SessionRevocationProcessor, MaintenanceProcessor, WorkerScheduler],
})
export class WorkerModule {}
