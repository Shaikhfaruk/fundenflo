import { Module } from '@nestjs/common';

import { InfrastructureModule } from '../infrastructure/infrastructure.module.js';
import { AccessModule } from '../modules/access/access.module.js';
import { AuthorizationModule } from '../modules/access/authorization.module.js';
import { AuditModule } from '../modules/audit/audit.module.js';
import { NotificationsModule } from '../modules/notifications/notifications.module.js';

@Module({
  imports: [
    InfrastructureModule.forRoot({ processName: 'script' }),
    AuditModule.forRoot({ http: false }),
    AuthorizationModule,
    NotificationsModule.forRoot({ worker: false }),
    AccessModule,
  ],
})
export class ScriptModule {}
