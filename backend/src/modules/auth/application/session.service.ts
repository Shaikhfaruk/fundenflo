import { randomUUID } from 'node:crypto';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { DAY_MS } from '../../../common/constants/time.constants.js';
import type { UserActor } from '../../../common/context/actor.js';
import { RequestContext } from '../../../common/context/request-context.service.js';
import { type LoginMethod, MembershipStatus, OrganizationStatus, SessionContext, UserStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { DeviceInput } from '../../../common/validation/common.schemas.js';
import { InjectConfig } from '../../../config/config.constants.js';
import type { AppConfig } from '../../../config/env.schema.js';
import type { Session } from '../../../generated/prisma/client.js';
import { randomToken, sha256 } from '../../../infrastructure/crypto/secure-random.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { RevocationRegistry } from '../../../infrastructure/security/revocation.service.js';
import type { MembershipWithOrganization } from '../../access/infrastructure/access.repository.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { REFRESH_TOKEN_BYTES } from '../domain/auth.constants.js';
import { RevokeReason } from '../domain/auth.enums.js';
import type { AccessClaims, SessionView, TokenPair } from '../domain/auth.types.js';
import { type RefreshWithSession, SessionRepository } from '../infrastructure/session.repository.js';
import { TokenService } from './token.service.js';

export type IssuedSession = {
  session: Session;
  membership: MembershipWithOrganization | null;
  tokens: TokenPair;
};

export function actorForSession(session: Session, membership: MembershipWithOrganization | null): UserActor {
  return {
    type: 'user',
    userId: session.userId,
    sessionId: session.id,
    membershipId: membership?.id ?? null,
    context: membership?.context ?? SessionContext.none,
    role: membership?.role ?? null,
    organizationId: membership?.organizationId ?? null,
  };
}

@Injectable()
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
    private readonly revocations: RevocationRegistry,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  async start(input: { userId: string; membership: MembershipWithOrganization | null; loginMethod: LoginMethod; device?: DeviceInput }): Promise<IssuedSession> {
    const session = await this.sessions.create({
      userId: input.userId,
      membershipId: input.membership?.id ?? null,
      context: input.membership?.context ?? SessionContext.none,
      loginMethod: input.loginMethod,
      deviceId: input.device?.id ?? null,
      deviceName: input.device?.name ?? null,
      platform: input.device?.platform ?? null,
      ip: this.context.ip ?? null,
      userAgent: this.context.userAgent ?? null,
      expiresAt: new Date(Date.now() + this.config.SESSION_MAX_AGE_DAYS * DAY_MS),
    });
    const tokens = await this.issueTokens(session, input.membership, randomUUID(), null);
    await this.outbox.publish({
      name: EventName.SessionCreated,
      aggregateType: 'session',
      aggregateId: session.id,
      payload: { sessionId: session.id, userId: session.userId, context: session.context, loginMethod: session.loginMethod },
    });
    return { session, membership: input.membership, tokens };
  }

  async refresh(refreshToken: string): Promise<IssuedSession> {
    const record = await this.sessions.findRefreshByHash(sha256(refreshToken));
    if (!record) throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID);
    if (record.usedAt) {
      await this.handleReuse(record);
      throw new AppError(ErrorCode.REFRESH_TOKEN_REUSED);
    }
    const now = Date.now();
    const { session } = record;
    if (record.revokedAt || record.expiresAt.getTime() <= now || session.revokedAt || session.expiresAt.getTime() <= now) {
      throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID);
    }
    if (session.user.status !== UserStatus.active) {
      await this.revoke([session.id], RevokeReason.UserSuspended);
      throw new AppError(ErrorCode.USER_SUSPENDED);
    }
    const membership = session.membership;
    if (membership && (membership.status !== MembershipStatus.active || (membership.organization && membership.organization.status !== OrganizationStatus.active))) {
      await this.revoke([session.id], RevokeReason.MembershipChanged);
      throw new AppError(ErrorCode.MEMBERSHIP_INACTIVE);
    }
    return this.rotate(record, membership);
  }

  @Transactional()
  async switchContext(sessionId: string, membership: MembershipWithOrganization): Promise<IssuedSession> {
    const previous = await this.sessions.findById(sessionId);
    if (!previous || previous.revokedAt) throw new AppError(ErrorCode.SESSION_REVOKED);
    const session = await this.sessions.update(sessionId, { membershipId: membership.id, context: membership.context, lastSeenAt: new Date() });
    await this.sessions.revokeRefreshTokens({ sessionId });
    const tokens = await this.issueTokens(session, membership, randomUUID(), null);
    await this.audit.record({
      action: AuditAction.ContextSwitched,
      entityType: AuditEntity.Session,
      entityId: sessionId,
      actor: actorForSession(session, membership),
      metadata: { from: { membershipId: previous.membershipId, context: previous.context }, to: { membershipId: membership.id, context: membership.context } },
    });
    return { session, membership, tokens };
  }

  @Transactional()
  async revoke(sessionIds: string[], reason: RevokeReason): Promise<number> {
    if (sessionIds.length === 0) return 0;
    const result = await this.sessions.revokeSessions(sessionIds, reason);
    await this.sessions.revokeRefreshTokens({ sessionId: { in: sessionIds } });
    await this.revocations.revokeSessions(sessionIds);
    for (const sessionId of sessionIds) {
      await this.outbox.publish({ name: EventName.SessionRevoked, aggregateType: 'session', aggregateId: sessionId, payload: { sessionId, reason } });
    }
    return result.count;
  }

  async revokeForUser(userId: string, reason: RevokeReason, exceptSessionId?: string): Promise<number> {
    const rows = await this.sessions.findActiveIds({ userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) });
    return this.revoke(rows.map((row) => row.id), reason);
  }

  async revokeForMembership(membershipId: string, reason: RevokeReason): Promise<number> {
    const rows = await this.sessions.findActiveIds({ membershipId });
    return this.revoke(rows.map((row) => row.id), reason);
  }

  async listActive(userId: string, currentSessionId: string): Promise<SessionView[]> {
    const sessions = await this.sessions.listActive(userId);
    return sessions.map((session) => ({
      id: session.id,
      context: session.context,
      loginMethod: session.loginMethod,
      deviceName: session.deviceName,
      platform: session.platform,
      ip: session.ip,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      current: session.id === currentSessionId,
    }));
  }

  async findOwned(userId: string, sessionId: string): Promise<Session> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.userId !== userId || session.revokedAt) throw new AppError(ErrorCode.NOT_FOUND);
    return session;
  }

  @Transactional()
  private async rotate(record: RefreshWithSession, membership: MembershipWithOrganization | null): Promise<IssuedSession> {
    const marked = await this.sessions.markRefreshUsed(record.id);
    if (marked.count === 0) throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID);
    const session = await this.sessions.update(record.sessionId, {
      lastSeenAt: new Date(),
      ip: this.context.ip ?? record.session.ip,
      userAgent: this.context.userAgent ?? record.session.userAgent,
    });
    const tokens = await this.issueTokens(session, membership, record.familyId, record.id);
    return { session, membership, tokens };
  }

  @Transactional()
  private async handleReuse(record: RefreshWithSession) {
    await this.sessions.revokeRefreshTokens({ familyId: record.familyId });
    await this.revoke([record.sessionId], RevokeReason.RefreshReuse);
    await this.audit.record({
      action: AuditAction.RefreshReused,
      entityType: AuditEntity.Session,
      entityId: record.sessionId,
      actor: actorForSession(record.session, record.session.membership),
      metadata: { familyId: record.familyId },
    });
  }

  private async issueTokens(session: Session, membership: MembershipWithOrganization | null, familyId: string, rotatedFromId: string | null): Promise<TokenPair> {
    const now = Date.now();
    const refreshToken = randomToken(REFRESH_TOKEN_BYTES);
    const refreshExpiresAt = new Date(Math.min(now + this.config.REFRESH_TOKEN_TTL_DAYS * DAY_MS, session.expiresAt.getTime()));
    await this.sessions.createRefreshToken({ sessionId: session.id, familyId, tokenHash: sha256(refreshToken), rotatedFromId, expiresAt: refreshExpiresAt });
    const claims: AccessClaims = {
      userId: session.userId,
      sessionId: session.id,
      membershipId: membership?.id ?? null,
      context: membership?.context ?? SessionContext.none,
      role: membership?.role ?? null,
      organizationId: membership?.organizationId ?? null,
    };
    return {
      accessToken: await this.tokens.issueAccessToken(claims),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTtlSeconds,
      refreshExpiresIn: Math.floor((refreshExpiresAt.getTime() - now) / 1000),
    };
  }
}
