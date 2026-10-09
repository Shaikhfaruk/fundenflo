import { type DynamicModule, Global, Module } from '@nestjs/common';

import { AuditQueryService } from './application/audit-query.service.js';
import { AuditService } from './application/audit.service.js';
import { ChangeRecorder } from './application/change-recorder.service.js';
import { AdminAuditController } from './http/admin-audit.controller.js';

@Global()
@Module({})
export class AuditModule {
  static forRoot(options: { http: boolean }): DynamicModule {
    return {
      module: AuditModule,
      controllers: options.http ? [AdminAuditController] : [],
      providers: [AuditService, AuditQueryService, ChangeRecorder],
      exports: [AuditService, ChangeRecorder],
    };
  }
}
