import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { ConfigPublishingService } from '../application/config-publishing.service.js';
import {
  type ApproveChangeRequestDto,
  approveChangeRequestSchema,
  type ChangeRequestListQuery,
  changeRequestListSchema,
  type RejectChangeRequestDto,
  rejectChangeRequestSchema,
} from './config.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'ConfigDocument'));
const canDecide = CheckPolicies((ability) => ability.can(AppAction.Approve, 'ConfigDocument'));

@Controller('admin/change-requests')
@StaffOnly()
export class AdminChangeRequestsController {
  constructor(private readonly config: ConfigPublishingService) {}

  @Get()
  @canRead
  list(@ValidQuery(changeRequestListSchema) query: ChangeRequestListQuery, @CurrentAbility() ability: AppAbility) {
    return this.config.listChangeRequests(query, ability);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.config.getChangeRequest(id, ability);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @canDecide
  approve(@ValidParam('id', uuidSchema) id: string, @ValidBody(approveChangeRequestSchema) body: ApproveChangeRequestDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.config.approve(id, body.note, actor, ability);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @canDecide
  reject(@ValidParam('id', uuidSchema) id: string, @ValidBody(rejectChangeRequestSchema) body: RejectChangeRequestDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.config.reject(id, body.note, actor, ability);
  }
}
