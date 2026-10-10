import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { MeService } from '../../auth/application/me.service.js';
import { BorrowerKycService } from '../application/borrower-kyc.service.js';
import { BorrowerProfileService } from '../application/borrower-profile.service.js';
import { toBorrowerProfileView } from '../application/borrower.views.js';
import { type CreateBorrowerProfileDto, createBorrowerProfileSchema, type UpdateBorrowerProfileDto, updateBorrowerProfileSchema, type VerifyPanDto, verifyPanSchema } from './borrowers.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'BorrowerProfile'));

@Controller('borrower-profiles')
@AllowContexts(SessionContext.borrower, SessionContext.partner)
export class BorrowerProfilesController {
  constructor(
    private readonly profiles: BorrowerProfileService,
    private readonly kyc: BorrowerKycService,
    private readonly me: MeService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AllowContexts(SessionContext.borrower)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'BorrowerProfile'))
  async create(@ValidBody(createBorrowerProfileSchema) body: CreateBorrowerProfileDto, @CurrentActor() actor: UserActor) {
    return this.profiles.ensure(await this.me.partyIdOf(actor.userId), body, actor.userId);
  }

  @Get()
  @canRead
  list(@ValidQuery(pageQuerySchema) query: PageQuery, @CurrentAbility() ability: AppAbility) {
    return this.profiles.list(ability, query);
  }

  @Get(':id')
  @canRead
  async get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return toBorrowerProfileView(await this.profiles.get(id, ability));
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'BorrowerProfile'))
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateBorrowerProfileSchema) body: UpdateBorrowerProfileDto, @IfMatchVersion() version: number | undefined, @CurrentAbility() ability: AppAbility) {
    return this.profiles.update(id, body, version, ability);
  }

  @Post(':id/kyc/pan')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'BorrowerProfile'))
  verifyPan(@ValidParam('id', uuidSchema) id: string, @ValidBody(verifyPanSchema) body: VerifyPanDto, @CurrentAbility() ability: AppAbility) {
    return this.kyc.verifyPan(id, body, ability);
  }
}
