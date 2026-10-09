import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { type PageQuery, pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { PartnerLeadService } from '../application/partner-lead.service.js';
import { type CreateFollowUpDto, createFollowUpSchema, type LogActivityDto, logActivitySchema } from './leads.dto.js';

@Controller('partner/leads')
@AllowContexts(SessionContext.partner)
export class PartnerLeadActivitiesController {
  constructor(private readonly leads: PartnerLeadService) {}

  @Get(':id/activities')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Activity'))
  list(@ValidParam('id', uuidSchema) id: string, @ValidQuery(pageQuerySchema) query: PageQuery, @CurrentAbility() ability: AppAbility) {
    return this.leads.activities(id, ability, query);
  }

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Activity'))
  log(@ValidParam('id', uuidSchema) id: string, @ValidBody(logActivitySchema) body: LogActivityDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.leads.logActivity(id, body, actor, ability);
  }

  @Post(':id/follow-ups')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'FollowUp'))
  followUp(@ValidParam('id', uuidSchema) id: string, @ValidBody(createFollowUpSchema) body: CreateFollowUpDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.leads.createFollowUp(id, body, actor, ability);
  }
}
