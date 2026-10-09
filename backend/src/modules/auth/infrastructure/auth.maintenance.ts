import { Injectable } from '@nestjs/common';

import { DAY_MS } from '../../../common/constants/time.constants.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { RETENTION } from '../../../infrastructure/maintenance/maintenance.constants.js';
import { MaintenanceTask } from '../../../infrastructure/maintenance/maintenance-task.decorator.js';
import { RevokeReason } from '../domain/auth.enums.js';

@Injectable()
export class AuthMaintenance {
  constructor(private readonly prisma: PrismaService) {}

  @MaintenanceTask('auth.expired-otp-challenges')
  async purgeOtpChallenges(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION.otpChallengeDays * DAY_MS);
    return (await this.prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: cutoff } } })).count;
  }

  @MaintenanceTask('auth.expired-sessions')
  async expireSessions(): Promise<number> {
    const now = new Date();
    return (
      await this.prisma.session.updateMany({ where: { revokedAt: null, expiresAt: { lt: now } }, data: { revokedAt: now, revokeReason: RevokeReason.Expired } })
    ).count;
  }

  @MaintenanceTask('auth.stale-refresh-tokens')
  async purgeRefreshTokens(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION.refreshTokenDays * DAY_MS);
    return (await this.prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] } })).count;
  }
}
