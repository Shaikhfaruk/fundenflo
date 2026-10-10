import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessModule } from '../access/access.module.js';
import { PartiesModule } from '../parties/parties.module.js';
import { AdminUsersService } from './application/admin-users.service.js';
import { LoginIdentifierService } from './application/login-identifier.service.js';
import { LoginMethodsService } from './application/login-methods.service.js';
import { MeViewBuilder } from './application/me-view.builder.js';
import { UserMergeParticipant } from './application/user-merge.participant.js';
import { UserNotifier } from './application/user-notifier.service.js';
import { MeService } from './application/me.service.js';
import { OtpLoginService } from './application/otp-login.service.js';
import { OtpService } from './application/otp.service.js';
import { SessionAuthService } from './application/session-auth.service.js';
import { StaffAuthService } from './application/staff-auth.service.js';
import { AccessTokenGuard } from './http/access-token.guard.js';
import { AdminUsersController } from './http/admin-users.controller.js';
import { AuthController } from './http/auth.controller.js';
import { MeController } from './http/me.controller.js';
import { StaffAuthController } from './http/staff-auth.controller.js';
import { IdentityRepository } from './infrastructure/identity.repository.js';
import { OtpChallengeRepository } from './infrastructure/otp-challenge.repository.js';
import { SessionsModule } from './sessions.module.js';

@Module({
  imports: [SessionsModule, PartiesModule, AccessModule],
  controllers: [AuthController, StaffAuthController, MeController, AdminUsersController],
  providers: [
    UserMergeParticipant,
    IdentityRepository,
    OtpChallengeRepository,
    LoginIdentifierService,
    OtpService,
    MeViewBuilder,
    OtpLoginService,
    SessionAuthService,
    MeService,
    UserNotifier,
    LoginMethodsService,
    StaffAuthService,
    AdminUsersService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
  exports: [MeService, UserNotifier],
})
export class AuthModule {}
