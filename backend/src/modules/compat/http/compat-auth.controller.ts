import { Controller, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor, Public } from '../../../common/auth/auth.decorators.js';
import { COMPAT_PREFIX } from '../../../common/constants/http.constants.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import { RateLimitByIp } from '../../../infrastructure/rate-limit/rate-limit.guard.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { OtpLoginService } from '../../auth/application/otp-login.service.js';
import { RateLimitRules } from '../../auth/domain/auth.constants.js';
import { type OtpRequestDto, otpRequestSchema, type OtpVerifyDto, otpVerifySchema } from '../../auth/http/auth.dto.js';
import { CompatAuthService } from '../application/compat-auth.service.js';
import { type CompatProfileDto, compatProfileSchema } from './compat.dto.js';

@Controller(`${COMPAT_PREFIX}/auth`)
export class CompatAuthController {
  constructor(
    private readonly otpLogin: OtpLoginService,
    private readonly auth: CompatAuthService,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @RateLimitByIp(RateLimitRules.otpRequest)
  requestOtp(@ValidBody(otpRequestSchema) body: OtpRequestDto) {
    return this.otpLogin.request(body);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimitByIp(RateLimitRules.otpVerify)
  verifyOtp(@ValidBody(otpVerifySchema) body: OtpVerifyDto) {
    return this.auth.verify(body);
  }

  @Patch('profile')
  @AllowContexts(SessionContext.borrower)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'BorrowerProfile'))
  profile(@ValidBody(compatProfileSchema) body: CompatProfileDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.auth.profile(body, actor, ability);
  }
}
