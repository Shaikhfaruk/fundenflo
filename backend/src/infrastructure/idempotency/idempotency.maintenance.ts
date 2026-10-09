import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { MaintenanceTask } from '../maintenance/maintenance-task.decorator.js';

@Injectable()
export class IdempotencyMaintenance {
  constructor(private readonly prisma: PrismaService) {}

  @MaintenanceTask('idempotency.expired-keys')
  async purgeExpired(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return result.count;
  }
}
