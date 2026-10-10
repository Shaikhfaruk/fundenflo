import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { PartnerBorrowerService } from '../application/partner-borrower.service.js';
import { type PartnerBorrowerDto, partnerBorrowerSchema } from './borrowers.dto.js';

@Controller('partner/borrowers')
@AllowContexts(SessionContext.partner)
export class PartnerBorrowersController {
  constructor(private readonly borrowers: PartnerBorrowerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'BorrowerProfile'))
  register(@ValidBody(partnerBorrowerSchema) body: PartnerBorrowerDto, @CurrentActor() actor: UserActor) {
    return this.borrowers.register(body, actor);
  }
}
