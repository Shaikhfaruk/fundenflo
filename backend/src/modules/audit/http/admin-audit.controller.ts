import { Controller, Get } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { AuditQueryService } from '../application/audit-query.service.js';
import { type AuditQuery, auditQuerySchema, type AuditVerifyQuery, auditVerifyQuerySchema } from './audit.dto.js';

@Controller('admin/audit-events')
@StaffOnly()
export class AdminAuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'AuditEvent'))
  list(@ValidQuery(auditQuerySchema) query: AuditQuery) {
    return this.audit.list(query);
  }

  @Get('verify')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'AuditEvent'))
  verify(@ValidQuery(auditVerifyQuerySchema) query: AuditVerifyQuery) {
    return this.audit.verifyChain(query.fromSeq, query.limit);
  }
}
