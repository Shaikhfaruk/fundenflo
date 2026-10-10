import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { LenderService } from '../application/lender.service.js';
import {
  type CreateAgreementDto,
  createAgreementSchema,
  type CreateContactDto,
  createContactSchema,
  type CreateLenderDto,
  createLenderSchema,
  type ListLendersDto,
  listLendersSchema,
  type UpdateAgreementDto,
  updateAgreementSchema,
  type UpdateContactDto,
  updateContactSchema,
  type UpdateLenderDto,
  updateLenderSchema,
} from './lenders.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'Lender'));
const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'Lender'));

@Controller('admin/lenders')
@StaffOnly()
export class AdminLendersController {
  constructor(private readonly lenders: LenderService) {}

  @Get()
  @canRead
  list(@ValidQuery(listLendersSchema) query: ListLendersDto, @CurrentAbility() ability: AppAbility) {
    return this.lenders.list(ability, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Lender'))
  create(@ValidBody(createLenderSchema) body: CreateLenderDto, @CurrentActor() actor: UserActor) {
    return this.lenders.create(body, actor);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.lenders.get(id, ability);
  }

  @Patch(':id')
  @canUpdate
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateLenderSchema) body: UpdateLenderDto, @IfMatchVersion() version: number | undefined, @CurrentAbility() ability: AppAbility) {
    return this.lenders.update(id, body, version, ability);
  }

  @Get(':id/agreements')
  @canRead
  agreements(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.lenders.agreements(id, ability);
  }

  @Post(':id/agreements')
  @HttpCode(HttpStatus.CREATED)
  @canUpdate
  createAgreement(@ValidParam('id', uuidSchema) id: string, @ValidBody(createAgreementSchema) body: CreateAgreementDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.lenders.createAgreement(id, body, actor, ability);
  }

  @Patch(':id/agreements/:aid')
  @canUpdate
  updateAgreement(
    @ValidParam('id', uuidSchema) id: string,
    @ValidParam('aid', uuidSchema) aid: string,
    @ValidBody(updateAgreementSchema) body: UpdateAgreementDto,
    @IfMatchVersion() version: number | undefined,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.lenders.updateAgreement(id, aid, body, version, ability);
  }

  @Get(':id/contacts')
  @canRead
  contacts(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.lenders.contacts(id, ability);
  }

  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  @canUpdate
  createContact(@ValidParam('id', uuidSchema) id: string, @ValidBody(createContactSchema) body: CreateContactDto, @CurrentAbility() ability: AppAbility) {
    return this.lenders.createContact(id, body, ability);
  }

  @Patch(':id/contacts/:cid')
  @canUpdate
  updateContact(
    @ValidParam('id', uuidSchema) id: string,
    @ValidParam('cid', uuidSchema) cid: string,
    @ValidBody(updateContactSchema) body: UpdateContactDto,
    @IfMatchVersion() version: number | undefined,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.lenders.updateContact(id, cid, body, version, ability);
  }
}
