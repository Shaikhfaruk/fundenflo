import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { LenderPortalService } from '../application/lender-portal.service.js';
import { type ProposeChangeDto, proposeChangeSchema } from './lenders.dto.js';

@Controller('lender/products')
@AllowContexts(SessionContext.lender)
export class LenderProductsController {
  constructor(private readonly portal: LenderPortalService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Lender'))
  list(@CurrentActor() actor: UserActor) {
    return this.portal.products(actor);
  }

  @Post(':id/change-requests')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Lender'))
  propose(@ValidParam('id', uuidSchema) id: string, @ValidBody(proposeChangeSchema) body: ProposeChangeDto, @CurrentActor() actor: UserActor) {
    return this.portal.propose(id, body, actor);
  }
}
