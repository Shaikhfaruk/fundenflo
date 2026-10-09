import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { Public } from '../../../common/auth/auth.decorators.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import { RateLimitByIp } from '../../../infrastructure/rate-limit/rate-limit.guard.js';
import { StaffAuthService } from '../application/staff-auth.service.js';
import { RateLimitRules } from '../domain/auth.constants.js';
import {
  type AcceptStaffInvitationDto,
  acceptStaffInvitationSchema,
  type StaffLoginDto,
  staffLoginSchema,
  type StaffMfaDto,
  staffMfaSchema,
} from './auth.dto.js';

@Controller('auth/staff')
@Public()
export class StaffAuthController {
  constructor(private readonly staffAuth: StaffAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimitByIp(RateLimitRules.staffLogin)
  login(@ValidBody(staffLoginSchema) body: StaffLoginDto) {
    return this.staffAuth.login(body.email, body.password);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimitByIp(RateLimitRules.staffMfa)
  verifyMfa(@ValidBody(staffMfaSchema) body: StaffMfaDto) {
    return this.staffAuth.verifyMfa(body.mfaToken, body.code, body.device);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @RateLimitByIp(RateLimitRules.invitationAccept)
  acceptInvitation(@ValidBody(acceptStaffInvitationSchema) body: AcceptStaffInvitationDto) {
    return this.staffAuth.acceptInvitation(body.token, body.password, body.fullName);
  }
}
