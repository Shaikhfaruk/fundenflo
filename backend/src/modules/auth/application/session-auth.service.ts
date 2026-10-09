import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { MembershipService, type ContextTarget } from '../../access/application/membership.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { RevokeReason } from '../domain/auth.enums.js';
import type { AuthResult } from '../domain/auth.types.js';
import { MeViewBuilder } from './me-view.builder.js';
import { SessionService } from './session.service.js';

@Injectable()
export class SessionAuthService {
  constructor(
    private readonly sessions: SessionService,
    private readonly memberships: MembershipService,
    private readonly me: MeViewBuilder,
    private readonly audit: AuditService,
  ) {}

  async refresh(refreshToken: string): Promise<AuthResult> {
    const issued = await this.sessions.refresh(refreshToken);
    return { ...issued.tokens, user: await this.me.build(issued.session.userId, issued.membership?.id ?? null), nextAction: null };
  }

  @Transactional()
  async switchContext(actor: UserActor, target: ContextTarget): Promise<AuthResult> {
    const membership = await this.memberships.resolveContextTarget(actor.userId, target);
    const issued = await this.sessions.switchContext(actor.sessionId, membership);
    return { ...issued.tokens, user: await this.me.build(actor.userId, membership.id), nextAction: null };
  }

  @Transactional()
  async logout(actor: UserActor): Promise<void> {
    await this.sessions.revoke([actor.sessionId], RevokeReason.Logout);
    await this.audit.record({ action: AuditAction.Logout, entityType: AuditEntity.Session, entityId: actor.sessionId });
  }
}
