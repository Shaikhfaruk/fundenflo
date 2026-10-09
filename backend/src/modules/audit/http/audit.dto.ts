import { z } from 'zod';

import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { AUDIT_VERIFY_MAX_ROWS } from '../domain/audit.constants.js';

export const auditQuerySchema = pageQuerySchema.extend({
  actorUserId: z.uuid().optional(),
  entityType: z.string().trim().min(1).max(64).optional(),
  entityId: z.string().trim().min(1).max(128).optional(),
  action: z.string().trim().min(1).max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AuditQuery = z.output<typeof auditQuerySchema>;

export const auditVerifyQuerySchema = z.object({
  fromSeq: z.coerce.bigint().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(AUDIT_VERIFY_MAX_ROWS).default(1_000),
});

export type AuditVerifyQuery = z.output<typeof auditVerifyQuerySchema>;
