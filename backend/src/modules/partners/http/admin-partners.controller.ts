import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { PartnerAdminService } from '../application/partner-admin.service.js';
import {
  type ListPartnersQuery,
  listPartnersSchema,
  type PartnerLevelDto,
  partnerLevelSchema,
  type PartnerNoteDto,
  partnerNoteSchema,
  type VerifyPartnerDto,
  verifyPartnerSchema,
} from './partners.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'PartnerProfile'));
const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'PartnerProfile'));

@Controller('admin/partners')
@StaffOnly()
export class AdminPartnersController {
  constructor(private readonly partners: PartnerAdminService) {}

  @Get()
  @canRead
  list(@ValidQuery(listPartnersSchema) query: ListPartnersQuery) {
    return this.partners.list(query);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.partners.get(id, ability);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  verify(@ValidParam('id', uuidSchema) id: string, @ValidBody(verifyPartnerSchema) body: VerifyPartnerDto, @CurrentActor() actor: UserActor) {
    return this.partners.verify(id, body.decision, body.note, actor);
  }

  @Post(':id/level')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  level(@ValidParam('id', uuidSchema) id: string, @ValidBody(partnerLevelSchema) body: PartnerLevelDto) {
    return this.partners.setLevel(id, body.level, body.note);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  suspend(@ValidParam('id', uuidSchema) id: string, @ValidBody(partnerNoteSchema) body: PartnerNoteDto) {
    return this.partners.suspend(id, body.note);
  }

  @Post(':id/reinstate')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  reinstate(@ValidParam('id', uuidSchema) id: string, @ValidBody(partnerNoteSchema) body: PartnerNoteDto) {
    return this.partners.reinstate(id, body.note);
  }
}
