import { Injectable } from '@nestjs/common';

import type { OtpPurpose } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

@Injectable()
export class OtpChallengeRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.OtpChallengeUncheckedCreateInput) {
    return this.prisma.otpChallenge.create({ data });
  }

  findById(id: string) {
    return this.prisma.otpChallenge.findUnique({ where: { id } });
  }

  findLatestOpen(purpose: OtpPurpose, identifierHash: string) {
    return this.prisma.otpChallenge.findFirst({
      where: { purpose, identifierHash, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  supersedeOpen(purpose: OtpPurpose, identifierHash: string) {
    return this.prisma.otpChallenge.updateMany({
      where: { purpose, identifierHash, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
  }

  incrementAttempts(id: string) {
    return this.prisma.otpChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  consume(id: string) {
    return this.prisma.otpChallenge.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: new Date() } });
  }
}
