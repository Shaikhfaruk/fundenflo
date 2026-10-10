import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SignalStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { ConsistencyService } from '../application/consistency.service.js';

const listSchema = pageQuerySchema.extend({ status: z.enum(Object.values(SignalStatus)).optional(), applicationId: z.uuid().optional() });

const resolveSchema = z.object({ status: z.enum([SignalStatus.resolved, SignalStatus.dismissed]), note: z.string().trim().min(3).max(1_000) }).strict();

@Controller('ops/consistency-signals')
@StaffOnly()
export class OpsConsistencySignalsController {
  constructor(private readonly consistency: ConsistencyService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Party'))
  list(@ValidQuery(listSchema) query: z.output<typeof listSchema>) {
    return this.consistency.list(query);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Party'))
  resolve(@ValidParam('id', uuidSchema) id: string, @ValidBody(resolveSchema) body: z.output<typeof resolveSchema>, @CurrentActor() actor: UserActor) {
    return this.consistency.resolve(id, body, actor.userId);
  }
}
