import { Controller, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { toMembershipView } from '../application/access.views.js';
import { MembershipService } from '../application/membership.service.js';
import { AppAction, type AppAbility } from '../domain/ability.types.js';
import { type CreateMembershipDto, createMembershipSchema, type UpdateMembershipDto, updateMembershipSchema } from './access.dto.js';
import { CheckPolicies, CurrentAbility } from './policies.guard.js';

@Controller('admin/memberships')
@StaffOnly()
export class AdminMembershipsController {
  constructor(private readonly memberships: MembershipService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Membership'))
  async create(
    @ValidBody(createMembershipSchema) body: CreateMembershipDto,
    @CurrentActor() actor: UserActor,
    @CurrentAbility() ability: AppAbility,
  ) {
    return toMembershipView(await this.memberships.adminCreate(body, actor, ability));
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Membership'))
  async update(
    @ValidParam('id', uuidSchema) id: string,
    @ValidBody(updateMembershipSchema) body: UpdateMembershipDto,
    @IfMatchVersion() version: number | undefined,
    @CurrentAbility() ability: AppAbility,
  ) {
    return toMembershipView(await this.memberships.adminUpdate(id, body, version, ability));
  }
}
