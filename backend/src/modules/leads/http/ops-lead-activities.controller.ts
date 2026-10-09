import { accessibleBy } from '@casl/prisma/runtime';
import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { type PageQuery, pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { LeadActivityService } from '../application/lead-activity.service.js';
import { type CreateFollowUpDto, createFollowUpSchema, type LogActivityDto, logActivitySchema } from './leads.dto.js';

const staffActor = (actor: UserActor) => ({ userId: actor.userId, membershipId: actor.membershipId, organizationId: null });

@Controller('ops/leads')
@StaffOnly()
export class OpsLeadActivitiesController {
  constructor(private readonly activities: LeadActivityService) {}

  @Get(':id/activities')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Lead') && ability.can(AppAction.Read, 'Activity'))
  list(@ValidParam('id', uuidSchema) id: string, @ValidQuery(pageQuerySchema) query: PageQuery, @CurrentAbility() ability: AppAbility) {
    return this.activities.list(id, accessibleBy(ability, AppAction.Read).ofType('Activity'), query);
  }

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Lead') && ability.can(AppAction.Create, 'Activity'))
  log(@ValidParam('id', uuidSchema) id: string, @ValidBody(logActivitySchema) body: LogActivityDto, @CurrentActor() actor: UserActor) {
    return this.activities.record(id, body, staffActor(actor));
  }

  @Post(':id/follow-ups')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Lead') && ability.can(AppAction.Create, 'FollowUp'))
  followUp(@ValidParam('id', uuidSchema) id: string, @ValidBody(createFollowUpSchema) body: CreateFollowUpDto, @CurrentActor() actor: UserActor) {
    if (body.assigneeMembershipId) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'assigneeMembershipId', code: 'not_supported', message: 'staff follow-ups are assigned to the person creating them' }] });
    return this.activities.createFollowUp(id, body, staffActor(actor));
  }
}
