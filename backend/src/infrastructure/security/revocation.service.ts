import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { InjectConfig } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { InjectRedis } from '../redis/redis.module.js';
import { REVOCATION_GRACE_SECONDS, RevocationKey } from './security.constants.js';

export type RevocationSubject = {
  sessionId: string;
  userId: string;
  membershipId: string | null;
};

@Injectable()
export class RevocationRegistry {
  private readonly ttlSeconds: number;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectConfig() config: AppConfig,
  ) {
    this.ttlSeconds = config.JWT_ACCESS_TTL_SECONDS + REVOCATION_GRACE_SECONDS;
  }

  async revokeSessions(sessionIds: string[]) {
    if (sessionIds.length === 0) return;
    const pipeline = this.redis.pipeline();
    for (const id of sessionIds) pipeline.set(RevocationKey.session(id), '1', 'EX', this.ttlSeconds);
    await pipeline.exec();
  }

  async revokeMembership(membershipId: string) {
    await this.redis.set(RevocationKey.membership(membershipId), '1', 'EX', this.ttlSeconds);
  }

  async restoreMembership(membershipId: string) {
    await this.redis.del(RevocationKey.membership(membershipId));
  }

  async revokeUser(userId: string) {
    await this.redis.set(RevocationKey.user(userId), '1', 'EX', this.ttlSeconds);
  }

  async restoreUser(userId: string) {
    await this.redis.del(RevocationKey.user(userId));
  }

  async isRevoked(subject: RevocationSubject): Promise<boolean> {
    const keys = [RevocationKey.session(subject.sessionId), RevocationKey.user(subject.userId)];
    if (subject.membershipId) keys.push(RevocationKey.membership(subject.membershipId));
    const values = await this.redis.mget(...keys);
    return values.some((value) => value !== null);
  }
}
