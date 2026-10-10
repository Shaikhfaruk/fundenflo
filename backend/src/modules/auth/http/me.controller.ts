import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';

import { AnyContext, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { LoginMethodsService } from '../application/login-methods.service.js';
import { MeService } from '../application/me.service.js';
import { SessionService } from '../application/session.service.js';
import {
  type ChallengeVerifyDto,
  challengeVerifySchema,
  type LinkEmailDto,
  linkEmailSchema,
  type MobileChangeDto,
  mobileChangeSchema,
  type PushTokenDto,
  pushTokenSchema,
  type UpdateProfileDto,
  updateProfileSchema,
} from './auth.dto.js';

@Controller('me')
@AnyContext()
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly loginMethods: LoginMethodsService,
    private readonly sessionService: SessionService,
  ) {}

  @Get()
  get(@CurrentActor() actor: UserActor) {
    return this.me.get(actor);
  }

  @Patch('profile')
  updateProfile(
    @CurrentActor() actor: UserActor,
    @ValidBody(updateProfileSchema) body: UpdateProfileDto,
    @IfMatchVersion() version: number | undefined,
  ) {
    return this.me.updateProfile(actor, { displayName: body.fullName, preferredLanguage: body.preferredLanguage }, version);
  }

  @Get('sessions')
  async sessions(@CurrentActor() actor: UserActor) {
    return { items: await this.me.listSessions(actor) };
  }

  @Put('sessions/current/push-token')
  setPushToken(@CurrentActor() actor: UserActor, @ValidBody(pushTokenSchema) body: PushTokenDto) {
    return this.sessionService.setPushToken(actor.sessionId, body.token);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@CurrentActor() actor: UserActor, @ValidParam('id', uuidSchema) id: string) {
    await this.me.revokeSession(actor, id);
  }

  @Delete('sessions')
  revokeOtherSessions(@CurrentActor() actor: UserActor) {
    return this.me.revokeOtherSessions(actor);
  }

  @Get('logins')
  async logins(@CurrentActor() actor: UserActor) {
    return { items: await this.loginMethods.list(actor) };
  }

  @Post('logins')
  @HttpCode(HttpStatus.ACCEPTED)
  startLink(@CurrentActor() actor: UserActor, @ValidBody(linkEmailSchema) body: LinkEmailDto) {
    return this.loginMethods.startEmailLink(actor, body.email);
  }

  @Post('logins/verify')
  @HttpCode(HttpStatus.CREATED)
  completeLink(@CurrentActor() actor: UserActor, @ValidBody(challengeVerifySchema) body: ChallengeVerifyDto) {
    return this.loginMethods.completeEmailLink(actor, body.challengeId, body.otp);
  }

  @Delete('logins/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLogin(@CurrentActor() actor: UserActor, @ValidParam('id', uuidSchema) id: string) {
    await this.loginMethods.remove(actor, id);
  }

  @Post('mobile-change')
  @HttpCode(HttpStatus.ACCEPTED)
  startMobileChange(@CurrentActor() actor: UserActor, @ValidBody(mobileChangeSchema) body: MobileChangeDto) {
    return this.loginMethods.startMobileChange(actor, body.mobile, body.countryCode);
  }

  @Post('mobile-change/verify')
  @HttpCode(HttpStatus.OK)
  completeMobileChange(@CurrentActor() actor: UserActor, @ValidBody(challengeVerifySchema) body: ChallengeVerifyDto) {
    return this.loginMethods.completeMobileChange(actor, body.challengeId, body.otp);
  }
}
