import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { type ProfilePatch, PartyService } from '../../parties/application/party.service.js';
import { RevokeReason } from '../domain/auth.enums.js';
import type { MeView, SessionView } from '../domain/auth.types.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';
import { MeViewBuilder } from './me-view.builder.js';
import { SessionService } from './session.service.js';

@Injectable()
export class MeService {
  constructor(
    private readonly me: MeViewBuilder,
    private readonly identity: IdentityRepository,
    private readonly parties: PartyService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  get(actor: UserActor): Promise<MeView> {
    return this.me.build(actor.userId, actor.membershipId);
  }

  @Transactional()
  async updateProfile(actor: UserActor, patch: ProfilePatch, expectedVersion: number | undefined): Promise<MeView> {
    const user = await this.identity.findUser(actor.userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    await this.parties.updateProfile(user.partyId, patch, expectedVersion);
    await this.audit.record({
      action: AuditAction.ProfileUpdated,
      entityType: AuditEntity.Party,
      entityId: user.partyId,
      metadata: { fields: Object.keys(patch) },
    });
    return this.me.build(actor.userId, actor.membershipId);
  }

  listSessions(actor: UserActor): Promise<SessionView[]> {
    return this.sessions.listActive(actor.userId, actor.sessionId);
  }

  @Transactional()
  async revokeSession(actor: UserActor, sessionId: string): Promise<void> {
    await this.sessions.findOwned(actor.userId, sessionId);
    await this.sessions.revoke([sessionId], sessionId === actor.sessionId ? RevokeReason.Logout : RevokeReason.RevokedByUser);
    await this.audit.record({ action: AuditAction.SessionRevoked, entityType: AuditEntity.Session, entityId: sessionId });
  }

  @Transactional()
  async revokeOtherSessions(actor: UserActor): Promise<{ revoked: number }> {
    const revoked = await this.sessions.revokeForUser(actor.userId, RevokeReason.LogoutOthers, actor.sessionId);
    await this.audit.record({ action: AuditAction.SessionRevoked, entityType: AuditEntity.User, entityId: actor.userId, metadata: { revoked, scope: 'others' } });
    return { revoked };
  }
}
