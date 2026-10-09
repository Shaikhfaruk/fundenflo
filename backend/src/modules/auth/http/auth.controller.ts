import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AnyContext, CurrentActor, Public } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import { RateLimitByIp } from '../../../infrastructure/rate-limit/rate-limit.guard.js';
import { OtpLoginService } from '../application/otp-login.service.js';
import { SessionAuthService } from '../application/session-auth.service.js';
import { RateLimitRules } from '../domain/auth.constants.js';
import {
  type OtpRequestDto,
  otpRequestSchema,
  type OtpVerifyDto,
  otpVerifySchema,
  type RefreshDto,
  refreshSchema,
  type SwitchContextDto,
  switchContextSchema,
} from './auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly otpLogin: OtpLoginService,
    private readonly sessionAuth: SessionAuthService,
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
    return this.otpLogin.verify(body);
  }

  @Public()
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimitByIp(RateLimitRules.tokenRefresh)
  refresh(@ValidBody(refreshSchema) body: RefreshDto) {
    return this.sessionAuth.refresh(body.refreshToken);
  }

  @AnyContext()
  @Post('switch-context')
  @HttpCode(HttpStatus.OK)
  switchContext(@CurrentActor() actor: UserActor, @ValidBody(switchContextSchema) body: SwitchContextDto) {
    return this.sessionAuth.switchContext(actor, body);
  }

  @AnyContext()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentActor() actor: UserActor) {
    await this.sessionAuth.logout(actor);
  }
}
