import { accessibleBy } from '@casl/prisma/runtime';
import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { LeadConversionService } from '../application/lead-conversion.service.js';
import { ConversionDecision, type ConversionDecisionDto, conversionDecisionSchema, type ConversionListDto, conversionListSchema } from './leads.dto.js';

@Controller('ops/offline-conversions')
@StaffOnly()
export class OpsOfflineConversionsController {
  constructor(private readonly conversions: LeadConversionService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'OfflineConversion'))
  list(@ValidQuery(conversionListSchema) query: ConversionListDto, @CurrentAbility() ability: AppAbility) {
    return this.conversions.list(accessibleBy(ability, AppAction.Read).ofType('OfflineConversion'), query.status, query);
  }

  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Approve, 'OfflineConversion'))
  decide(@ValidParam('id', uuidSchema) id: string, @ValidBody(conversionDecisionSchema) body: ConversionDecisionDto, @CurrentActor() actor: UserActor) {
    return this.conversions.decide(id, body.decision === ConversionDecision.Verify, body.note, actor.userId);
  }
}
