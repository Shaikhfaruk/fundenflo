import { Controller, Get } from '@nestjs/common';
import { z } from 'zod';

import { CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { SyncService } from '../application/sync.service.js';
import { SYNC_DEFAULT_LIMIT, SYNC_MAX_LIMIT, SyncType } from '../domain/sync.types.js';

const syncQuerySchema = z.object({
  since: z.string().max(500).optional(),
  updatedSince: z.coerce.date().optional(),
  types: z
    .string()
    .transform((value) => value.split(',').map((type) => type.trim()).filter(Boolean))
    .pipe(z.array(z.enum(Object.values(SyncType))).min(1))
    .optional(),
  limit: z.coerce.number().int().min(1).max(SYNC_MAX_LIMIT).default(SYNC_DEFAULT_LIMIT),
});

type SyncQuery = z.output<typeof syncQuerySchema>;

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('changes')
  @CheckPolicies(() => true)
  changes(@ValidQuery(syncQuerySchema) query: SyncQuery, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.sync.changes({ ability, actor }, query);
  }
}
