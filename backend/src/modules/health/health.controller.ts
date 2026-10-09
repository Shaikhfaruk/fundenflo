import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import type { Redis } from 'ioredis';

import { Public } from '../../common/auth/auth.decorators.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { InjectRedis } from '../../infrastructure/redis/redis.module.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.check('database', () => this.prisma.$queryRaw`SELECT 1`), () => this.check('redis', () => this.redis.ping())]);
  }

  private async check(key: string, probe: () => Promise<unknown>) {
    const indicator = this.indicators.check(key);
    try {
      await probe();
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: error instanceof Error ? error.message : 'unavailable' });
    }
  }
}
