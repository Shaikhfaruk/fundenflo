import { Module } from '@nestjs/common';

import { SessionService } from './application/session.service.js';
import { TokenService } from './application/token.service.js';
import { AuthMaintenance } from './infrastructure/auth.maintenance.js';
import { SessionRepository } from './infrastructure/session.repository.js';

@Module({
  providers: [SessionRepository, TokenService, SessionService, AuthMaintenance],
  exports: [SessionRepository, TokenService, SessionService],
})
export class SessionsModule {}
