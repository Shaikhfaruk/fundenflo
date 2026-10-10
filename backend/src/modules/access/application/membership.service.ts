import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { EventName } from '../../../common/events/event-names.js';
import {
  type ContactType,
  LoginAs,
  MembershipStatus,
  OrganizationStatus,
  Role,
  SessionContext,
} from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { RevocationRegistry } from '../../../infrastructure/security/revocation.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { AppAction, type AppAbility } from '../domain/ability.types.js';
import { CONTEXT_ROLES, LOGIN_AS_CONTEXT, ORGANIZATION_CONTEXT } from '../domain/access.constants.js';
import { assertRoleAllowed } from '../domain/role-rules.js';
import { AccessRepository, type MembershipWithOrganization } from '../infrastructure/access.repository.js';
import { toMemberView } from './access.views.js';
import { InvitationService } from './invitation.service.js';

export type ContextTarget = { membershipId: string } | { loginAs: typeof LoginAs.borrower };

export type MembershipPatch = {
  status?: typeof MembershipStatus.active | typeof MembershipStatus.suspended | typeof MembershipStatus.revoked;
  role?: Role;
};

@Injectable()
export class MembershipService {
  constructor(
    private readonly repository: AccessRepository,
    private readonly invitations: InvitationService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly revocations: RevocationRegistry,
  ) {}

  list(userId: string) {
    return this.repository.listMemberships(userId);
  }

  async resolveForLogin(userId: string, loginAs: LoginAs, contact: { channel: ContactType; hash: string }): Promise<MembershipWithOrganization | null> {
    const context = LOGIN_AS_CONTEXT[loginAs];
    await this.invitations.acceptPendingForContact(userId, contact.channel, contact.hash, context);
    if (context === SessionContext.borrower) return this.ensureBorrower(userId);
    return this.repository.findFirstActiveMembership(userId, context);
  }

  async requireActiveMember(organizationId: string, membershipId: string, context: Exclude<SessionContext, typeof SessionContext.none>) {
    const membership = await this.repository.findMembership(membershipId);
    if (membership?.organizationId !== organizationId || membership.status !== MembershipStatus.active || !CONTEXT_ROLES[context].includes(membership.role)) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'membershipId', code: 'not_an_active_member', message: 'not an active member of this organization' }] });
    }
    return membership;
  }

  async activeUserIds(organizationId: string, roles: readonly Role[]): Promise<string[]> {
    return (await this.repository.listMembers({ organizationId, status: MembershipStatus.active, role: { in: [...roles] } })).map((member) => member.userId);
  }

  async activeUserIdOf(membershipId: string): Promise<string | null> {
    const membership = await this.repository.findMembership(membershipId);
    return membership?.status === MembershipStatus.active ? membership.userId : null;
  }

  async activeStaffUserIds(roles: readonly Role[]): Promise<string[]> {
    const organization = await this.repository.findFundenfloOrganization();
    return organization ? this.activeUserIds(organization.id, roles) : [];
  }

  latestForContext(userId: string, context: SessionContext) {
    return this.repository.findLatestMembership(userId, context);
  }

  async listMembers(organizationId: string, ability: AppAbility) {
    const rows = await this.repository.listMembers({ AND: [accessibleBy(ability, AppAction.Read).ofType('Membership'), { organizationId }] });
    return rows.map(toMemberView);
  }

  async ensureBorrower(userId: string): Promise<MembershipWithOrganization> {
    await this.repository.lockUser(userId);
    const existing = await this.repository.findPersonalMembership(userId, Role.borrower);
    if (existing) {
      if (existing.status !== MembershipStatus.active) throw new AppError(ErrorCode.MEMBERSHIP_INACTIVE);
      return existing;
    }
    const membership = await this.repository.createMembership({
      userId,
      context: SessionContext.borrower,
      role: Role.borrower,
      status: MembershipStatus.active,
      approvedAt: new Date(),
    });
    await this.outbox.publish({
      name: EventName.MembershipCreated,
      aggregateType: 'membership',
      aggregateId: membership.id,
      payload: { membershipId: membership.id, userId, context: membership.context, role: membership.role },
    });
    return membership;
  }

  async resolveContextTarget(userId: string, target: ContextTarget): Promise<MembershipWithOrganization> {
    if ('loginAs' in target) return this.ensureBorrower(userId);
    const membership = await this.repository.findMembership(target.membershipId);
    if (!membership || membership.userId !== userId) throw new AppError(ErrorCode.MEMBERSHIP_NOT_FOUND);
    this.assertUsable(membership);
    return membership;
  }

  assertUsable(membership: MembershipWithOrganization) {
    if (membership.status !== MembershipStatus.active) throw new AppError(ErrorCode.MEMBERSHIP_INACTIVE);
    if (membership.organization && membership.organization.status !== OrganizationStatus.active) {
      throw new AppError(ErrorCode.ORGANIZATION_INACTIVE);
    }
  }

  @Transactional()
  async adminCreate(input: { userId: string; organizationId: string; role: Role }, actor: UserActor, ability: AppAbility) {
    const organization = await this.repository.findOrganization(input.organizationId);
    if (!organization) throw new AppError(ErrorCode.NOT_FOUND, { details: { organizationId: input.organizationId } });
    if (organization.status !== OrganizationStatus.active) throw new AppError(ErrorCode.ORGANIZATION_INACTIVE);
    const context = ORGANIZATION_CONTEXT[organization.type];
    assertRoleAllowed(context, input.role);
    const candidate = { ...input, context, organization: { type: organization.type } };
    if (!ability.can(AppAction.Create, subject('Membership', candidate as never))) throw new AppError(ErrorCode.FORBIDDEN);

    const membership = await this.repository.upsertOrganizationMembership({ ...input, context, approvedByUserId: actor.userId });
    await this.revocations.restoreMembership(membership.id);
    await this.outbox.publish({
      name: EventName.MembershipCreated,
      aggregateType: 'membership',
      aggregateId: membership.id,
      payload: { membershipId: membership.id, userId: input.userId, organizationId: organization.id, context, role: input.role },
    });
    await this.audit.record({
      action: AuditAction.MembershipCreated,
      entityType: AuditEntity.Membership,
      entityId: membership.id,
      metadata: { userId: input.userId, organizationId: organization.id, role: input.role },
    });
    return membership;
  }

  @Transactional()
  async adminUpdate(id: string, patch: MembershipPatch, expectedVersion: number | undefined, ability: AppAbility) {
    const membership = await this.repository.findMembership(id);
    if (!membership) throw new AppError(ErrorCode.NOT_FOUND);
    if (!ability.can(AppAction.Update, subject('Membership', membership as never))) throw new AppError(ErrorCode.FORBIDDEN);
    assertVersion(expectedVersion, membership.version);
    if (patch.role) assertRoleAllowed(membership.context, patch.role);

    const result = await this.repository.updateMembershipVersioned(id, membership.version, patch);
    if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: membership.version + 1 } });

    const status = patch.status ?? membership.status;
    if (status === MembershipStatus.active) await this.revocations.restoreMembership(id);
    else await this.revocations.revokeMembership(id);

    await this.outbox.publish({
      name: EventName.MembershipChanged,
      aggregateType: 'membership',
      aggregateId: id,
      payload: { membershipId: id, userId: membership.userId, status, role: patch.role ?? membership.role },
    });
    await this.audit.record({
      action: AuditAction.MembershipChanged,
      entityType: AuditEntity.Membership,
      entityId: id,
      metadata: { from: { status: membership.status, role: membership.role }, to: { status, role: patch.role ?? membership.role } },
    });
    const updated = await this.repository.findMembership(id);
    return updated as MembershipWithOrganization;
  }
}
