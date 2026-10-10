import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { MembershipStatus, OrganizationStatus, type OrganizationType, type Role } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { OrganizationEvent, organizationMachine } from '../../../engines/state-machines/machines/organization.machine.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { RevocationRegistry } from '../../../infrastructure/security/revocation.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { PartyService } from '../../parties/application/party.service.js';
import { ORGANIZATION_CONTEXT } from '../domain/access.constants.js';
import { assertRoleAllowed } from '../domain/role-rules.js';
import { AccessRepository } from '../infrastructure/access.repository.js';

export type PendingOrganizationInput = { type: OrganizationType; name: string; ownerUserId: string; ownerRole: Role };

@Injectable()
export class OrganizationService {
  constructor(
    private readonly repository: AccessRepository,
    private readonly parties: PartyService,
    private readonly revocations: RevocationRegistry,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async names(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    return new Map((await this.repository.findOrganizations(unique)).map((organization) => [organization.id, organization.name]));
  }

  @Transactional()
  async registerPending(input: PendingOrganizationInput) {
    const context = ORGANIZATION_CONTEXT[input.type];
    assertRoleAllowed(context, input.ownerRole);
    const party = await this.parties.createBusiness({ displayName: input.name });
    const organization = await this.repository.createOrganization({ partyId: party.id, type: input.type, name: input.name, status: OrganizationStatus.pending });
    const membership = await this.repository.createMembership({
      userId: input.ownerUserId,
      organizationId: organization.id,
      context,
      role: input.ownerRole,
      status: MembershipStatus.pending,
    });
    await this.outbox.publish({
      name: EventName.OrganizationCreated,
      aggregateType: AuditEntity.Organization,
      aggregateId: organization.id,
      payload: { organizationId: organization.id, type: organization.type, status: organization.status, ownerUserId: input.ownerUserId },
    });
    await this.outbox.publish({
      name: EventName.MembershipCreated,
      aggregateType: AuditEntity.Membership,
      aggregateId: membership.id,
      payload: { membershipId: membership.id, userId: input.ownerUserId, organizationId: organization.id, context, role: input.ownerRole },
    });
    await this.audit.record({
      action: AuditAction.OrganizationCreated,
      entityType: AuditEntity.Organization,
      entityId: organization.id,
      metadata: { type: organization.type, ownerUserId: input.ownerUserId, ownerRole: input.ownerRole },
    });
    return { organization, membership };
  }

  @Transactional()
  async registerActive(input: { type: OrganizationType; name: string; createdByUserId: string }) {
    const party = await this.parties.createBusiness({ displayName: input.name });
    const organization = await this.repository.createOrganization({ partyId: party.id, type: input.type, name: input.name, status: OrganizationStatus.active });
    await this.outbox.publish({
      name: EventName.OrganizationCreated,
      aggregateType: AuditEntity.Organization,
      aggregateId: organization.id,
      payload: { organizationId: organization.id, type: organization.type, status: organization.status, createdByUserId: input.createdByUserId },
    });
    await this.audit.record({ action: AuditAction.OrganizationCreated, entityType: AuditEntity.Organization, entityId: organization.id, metadata: { type: organization.type, createdByUserId: input.createdByUserId } });
    return organization;
  }

  ownedBy(userId: string, role: Role) {
    return this.repository.findOrganizationMemberships(userId, role);
  }

  @Transactional()
  async activate(organizationId: string, approvedByUserId: string) {
    const from = await this.move(organizationId, OrganizationEvent.Activate);
    await this.repository.updatePendingMemberships(organizationId, { status: MembershipStatus.active, approvedByUserId, approvedAt: new Date() });
    return this.afterStatusChange(organizationId, from, OrganizationStatus.active);
  }

  @Transactional()
  async suspend(organizationId: string) {
    const from = await this.move(organizationId, OrganizationEvent.Suspend);
    return this.afterStatusChange(organizationId, from, OrganizationStatus.suspended);
  }

  @Transactional()
  async reinstate(organizationId: string) {
    const from = await this.move(organizationId, OrganizationEvent.Reinstate);
    return this.afterStatusChange(organizationId, from, OrganizationStatus.active);
  }

  @Transactional()
  async close(organizationId: string) {
    const from = await this.move(organizationId, OrganizationEvent.Close);
    await this.repository.updatePendingMemberships(organizationId, { status: MembershipStatus.revoked });
    return this.afterStatusChange(organizationId, from, OrganizationStatus.closed);
  }

  private async move(organizationId: string, event: OrganizationEvent): Promise<OrganizationStatus> {
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) throw new AppError(ErrorCode.NOT_FOUND, { details: { organizationId } });
    const next = transitionOrThrow(organizationMachine, organization.status, event);
    const moved = await this.repository.updateOrganizationStatus(organizationId, organization.status, next);
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    return organization.status;
  }

  private async afterStatusChange(organizationId: string, from: OrganizationStatus, to: OrganizationStatus) {
    const memberships = await this.repository.listOrganizationMembershipIds(organizationId, [MembershipStatus.active, MembershipStatus.pending]);
    const membershipIds = memberships.map((membership) => membership.id);
    for (const id of membershipIds) {
      if (to === OrganizationStatus.active) await this.revocations.restoreMembership(id);
      else await this.revocations.revokeMembership(id);
    }
    await this.outbox.publish({
      name: EventName.OrganizationStatusChanged,
      aggregateType: AuditEntity.Organization,
      aggregateId: organizationId,
      payload: { organizationId, from, status: to, membershipIds },
    });
    await this.audit.record({ action: AuditAction.OrganizationStatusChanged, entityType: AuditEntity.Organization, entityId: organizationId, metadata: { from, to, memberships: membershipIds.length } });
    return { organizationId, from, status: to, membershipIds };
  }
}
