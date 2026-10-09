import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ContactType, UserStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { normaliseEmail, normaliseMobile } from '../../../engines/party-matching/normalise.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { RevocationRegistry } from '../../../infrastructure/security/revocation.service.js';
import { toMembershipView } from '../../access/application/access.views.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { AccessRepository } from '../../access/infrastructure/access.repository.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ContactCodec } from '../../parties/application/contact-codec.service.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';
import { SessionRepository } from '../infrastructure/session.repository.js';
import { toLoginView } from './me-view.builder.js';

export type AdminUserFilters = PageQuery & { q?: string; status?: UserStatus };

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly access: AccessRepository,
    private readonly sessions: SessionRepository,
    private readonly codec: ContactCodec,
    private readonly revocations: RevocationRegistry,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: AdminUserFilters, ability: AppAbility) {
    const window = pageWindow(filters);
    const where: Prisma.UserWhereInput = {
      AND: [accessibleBy(ability, AppAction.Read).ofType('User'), { id: window.idFilter, status: filters.status }, this.searchFilter(filters.q)],
    };
    const rows = await this.identity.listUsers(where, window.take);
    return toPage(rows, filters.limit, (user) => ({
      id: user.id,
      status: user.status,
      fullName: user.party.displayName,
      memberships: user._count.memberships,
      signupChannel: user.signupChannel,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      version: user.version,
    }));
  }

  async get(id: string, ability: AppAbility) {
    const user = await this.identity.findUser(id);
    if (!user || !ability.can(AppAction.Read, subject('User', user as never))) throw new AppError(ErrorCode.NOT_FOUND);
    const logins = await this.identity.listLogins(id);
    const memberships = await this.access.listMemberships(id);
    const activeSessions = await this.sessions.listActive(id);
    return {
      id: user.id,
      status: user.status,
      fullName: user.party.displayName,
      partyId: user.partyId,
      signupChannel: user.signupChannel,
      signupReferralCode: user.signupReferralCode,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      logins: logins.map(toLoginView),
      memberships: memberships.map(toMembershipView),
      activeSessions: activeSessions.length,
      version: user.version,
    };
  }

  @Transactional()
  async updateStatus(id: string, status: UserStatus, expectedVersion: number | undefined, ability: AppAbility) {
    const user = await this.identity.findUser(id);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    if (!ability.can(AppAction.Update, subject('User', user as never))) throw new AppError(ErrorCode.FORBIDDEN);
    assertVersion(expectedVersion, user.version);
    const result = await this.identity.updateUserVersioned(id, user.version, { status });
    if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: user.version + 1 } });
    if (status === UserStatus.active) await this.revocations.restoreUser(id);
    else await this.revocations.revokeUser(id);
    await this.outbox.publish({ name: EventName.UserStatusChanged, aggregateType: 'user', aggregateId: id, payload: { userId: id, status } });
    await this.audit.record({ action: AuditAction.UserStatusChanged, entityType: AuditEntity.User, entityId: id, metadata: { from: user.status, to: status } });
    return this.get(id, ability);
  }

  private searchFilter(query: string | undefined): Prisma.UserWhereInput {
    if (!query) return {};
    const email = normaliseEmail(query);
    if (email) {
      const hash = this.codec.hash(ContactType.email, email);
      return { OR: [{ logins: { some: { identifierHash: hash } } }, { party: { contacts: { some: { type: ContactType.email, valueHash: hash } } } }] };
    }
    const mobile = normaliseMobile(query);
    if (mobile) {
      const hash = this.codec.hash(ContactType.mobile, mobile.e164);
      return { OR: [{ logins: { some: { identifierHash: hash } } }, { party: { contacts: { some: { type: ContactType.mobile, valueHash: hash } } } }] };
    }
    return { party: { displayName: { contains: query, mode: 'insensitive' } } };
  }
}
