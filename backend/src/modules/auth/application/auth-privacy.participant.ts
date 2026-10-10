import { MembershipStatus, SessionContext, UserStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { RevocationRegistry } from '../../../infrastructure/security/revocation.service.js';
import { AccessRepository } from '../../access/infrastructure/access.repository.js';
import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { ERASURE_SESSION_REASON } from '../domain/auth.constants.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';
import { SessionRepository } from '../infrastructure/session.repository.js';

@PrivacyParticipantFor(PrivacySection.Account)
export class AuthPrivacyParticipant implements PrivacyParticipant {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly sessions: SessionRepository,
    private readonly access: AccessRepository,
    private readonly revocations: RevocationRegistry,
    private readonly outbox: OutboxService,
  ) {}

  async export(subject: PrivacySubject) {
    if (!subject.userId) return null;
    const user = await this.identity.findUser(subject.userId);
    if (!user) return null;
    const logins = (await this.identity.listLogins(user.id)).map((login) => ({ method: login.method, verifiedAt: login.verifiedAt.toISOString(), lastUsedAt: login.lastUsedAt?.toISOString() ?? null }));
    const memberships = (await this.access.listMemberships(user.id)).map((membership) => ({ role: membership.role, status: membership.status, organizationId: membership.organizationId, since: membership.createdAt.toISOString() }));
    return { userId: user.id, status: user.status, createdAt: user.createdAt.toISOString(), logins, memberships };
  }

  async holds(subject: PrivacySubject) {
    if (!subject.userId) return [];
    const memberships = await this.access.listMemberships(subject.userId);
    return memberships.some((membership) => membership.status === MembershipStatus.active && membership.context !== SessionContext.borrower) ? ['the person still works for a partner, lender or FundenFlo account; end those memberships first'] : [];
  }

  async erase(subject: PrivacySubject) {
    if (!subject.userId) return { sessions: 0, logins: 0, users: 0 };
    const active = await this.sessions.listActive(subject.userId);
    const revoked = await this.sessions.revokeSessions(active.map((session) => session.id), ERASURE_SESSION_REASON);
    const logins = await this.identity.listLogins(subject.userId);
    for (const login of logins) await this.identity.deleteLogin(login.id);
    const user = await this.identity.findUser(subject.userId);
    const updated = user ? await this.identity.updateUserVersioned(user.id, user.version, { status: UserStatus.deleted }) : { count: 0 };
    await this.revocations.revokeSessions(active.map((session) => session.id));
    await this.revocations.revokeUser(subject.userId);
    await this.outbox.publish({ name: EventName.UserStatusChanged, aggregateType: 'user', aggregateId: subject.userId, payload: { userId: subject.userId, status: UserStatus.deleted } });
    return { sessions: revoked.count, logins: logins.length, users: updated.count };
  }
}
