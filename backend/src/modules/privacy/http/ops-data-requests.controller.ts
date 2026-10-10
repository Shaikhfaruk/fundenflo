import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { DataRequestService } from '../application/data-request.service.js';
import { type CompleteDataRequestDto, completeDataRequestSchema, type ListDataRequestsDto, listDataRequestsSchema, type RejectDataRequestDto, rejectDataRequestSchema } from './privacy.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'DataSubjectRequest'));

const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'DataSubjectRequest'));

@Controller('ops/data-requests')
@StaffOnly()
export class OpsDataRequestsController {
  constructor(private readonly requests: DataRequestService) {}

  @Get()
  @canRead
  list(@ValidQuery(listDataRequestsSchema) query: ListDataRequestsDto, @CurrentAbility() ability: AppAbility) {
    return this.requests.list(ability, query);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.requests.get(id, ability);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  complete(@ValidParam('id', uuidSchema) id: string, @ValidBody(completeDataRequestSchema) body: CompleteDataRequestDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.requests.complete(id, body, actor, ability);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  reject(@ValidParam('id', uuidSchema) id: string, @ValidBody(rejectDataRequestSchema) body: RejectDataRequestDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.requests.reject(id, body.reason, actor, ability);
  }
}
