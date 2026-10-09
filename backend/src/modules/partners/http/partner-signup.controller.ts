import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { PartnerService } from '../application/partner.service.js';
import { type SignupDto, signupSchema } from './partners.dto.js';

@Controller('partner/signup')
@AllowContexts(SessionContext.none, SessionContext.borrower, SessionContext.partner)
export class PartnerSignupController {
  constructor(private readonly partners: PartnerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  signup(@ValidBody(signupSchema) body: SignupDto, @CurrentActor() actor: UserActor) {
    return this.partners.signup(actor, body);
  }
}
