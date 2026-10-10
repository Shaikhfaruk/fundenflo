import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { AttributionDisputeService } from '../application/attribution-dispute.service.js';
import { type ListDisputesDto, listDisputesSchema, type ResolveDisputeDto, resolveDisputeSchema } from './partners.dto.js';

@Controller('ops/attribution-disputes')
@StaffOnly()
export class OpsAttributionDisputesController {
  constructor(private readonly disputes: AttributionDisputeService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'AttributionDispute'))
  list(@ValidQuery(listDisputesSchema) query: ListDisputesDto, @CurrentAbility() ability: AppAbility) {
    return this.disputes.list(ability, query);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'AttributionDispute'))
  resolve(@ValidParam('id', uuidSchema) id: string, @ValidBody(resolveDisputeSchema) body: ResolveDisputeDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.disputes.resolve(id, body, actor, ability);
  }
}
