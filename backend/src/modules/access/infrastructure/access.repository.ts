import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import {
  type ContactType,
  InvitationStatus,
  MembershipStatus,
  OrganizationStatus,
  OrganizationType,
  type Role,
  SessionContext,
} from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const organizationSummary = { select: { id: true, name: true, type: true, status: true } } as const;

export const membershipWithOrganization = { organization: organizationSummary } satisfies Prisma.MembershipInclude;

export type MembershipWithOrganization = Prisma.MembershipGetPayload<{ include: typeof membershipWithOrganization }>;

export const invitationWithOrganization = { organization: organizationSummary } satisfies Prisma.InvitationInclude;

export type InvitationWithOrganization = Prisma.InvitationGetPayload<{ include: typeof invitationWithOrganization }>;

@Injectable()
export class AccessRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  findOrganization(id: string) {
    return this.txHost.tx.organization.findUnique({ where: { id } });
  }

  findOrganizations(ids: string[]) {
    return this.txHost.tx.organization.findMany({ where: { id: { in: ids } } });
  }

  findFundenfloOrganization() {
    return this.txHost.tx.organization.findFirst({ where: { type: OrganizationType.fundenflo }, orderBy: { createdAt: 'asc' } });
  }

  listMemberships(userId: string) {
    return this.txHost.tx.membership.findMany({ where: { userId }, include: membershipWithOrganization, orderBy: { createdAt: 'asc' } });
  }

  findMembership(id: string) {
    return this.txHost.tx.membership.findUnique({ where: { id }, include: membershipWithOrganization });
  }

  findFirstActiveMembership(userId: string, context: SessionContext) {
    return this.txHost.tx.membership.findFirst({
      where: {
        userId,
        context,
        status: MembershipStatus.active,
        OR: [{ organizationId: null }, { organization: { status: OrganizationStatus.active } }],
      },
      include: membershipWithOrganization,
      orderBy: { createdAt: 'asc' },
    });
  }

  findPersonalMembership(userId: string, role: Role) {
    return this.txHost.tx.membership.findFirst({ where: { userId, organizationId: null, role }, include: membershipWithOrganization });
  }

  async lockUser(userId: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  createMembership(data: Prisma.MembershipUncheckedCreateInput) {
    return this.txHost.tx.membership.create({ data, include: membershipWithOrganization });
  }

  updateMembershipVersioned(id: string, expectedVersion: number, data: Prisma.MembershipUncheckedUpdateManyInput) {
    return this.txHost.tx.membership.updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
  }

  upsertOrganizationMembership(input: { userId: string; organizationId: string; role: Role; context: SessionContext; approvedByUserId: string | null }) {
    const now = new Date();
    return this.txHost.tx.membership.upsert({
      where: { userId_organizationId_role: { userId: input.userId, organizationId: input.organizationId, role: input.role } },
      create: { ...input, status: MembershipStatus.active, approvedAt: now },
      update: { status: MembershipStatus.active, approvedByUserId: input.approvedByUserId, approvedAt: now, version: { increment: 1 } },
      include: membershipWithOrganization,
    });
  }

  createInvitation(data: Prisma.InvitationUncheckedCreateInput) {
    return this.txHost.tx.invitation.create({ data, include: invitationWithOrganization });
  }

  revokePendingDuplicates(input: { organizationId: string; role: Role; channel: ContactType; identifierHash: string }) {
    return this.txHost.tx.invitation.updateMany({
      where: { ...input, status: InvitationStatus.pending },
      data: { status: InvitationStatus.revoked, revokedAt: new Date() },
    });
  }

  findInvitation(id: string) {
    return this.txHost.tx.invitation.findUnique({ where: { id }, include: invitationWithOrganization });
  }

  findInvitationByToken(tokenHash: string) {
    return this.txHost.tx.invitation.findUnique({ where: { tokenHash }, include: invitationWithOrganization });
  }

  findAcceptableInvitations(channel: ContactType, identifierHash: string, context: SessionContext) {
    return this.txHost.tx.invitation.findMany({
      where: {
        channel,
        identifierHash,
        context,
        status: InvitationStatus.pending,
        expiresAt: { gt: new Date() },
        organization: { status: OrganizationStatus.active },
      },
      include: invitationWithOrganization,
    });
  }

  updateInvitation(id: string, data: Prisma.InvitationUncheckedUpdateInput) {
    return this.txHost.tx.invitation.update({ where: { id }, data, include: invitationWithOrganization });
  }

  listInvitations(where: Prisma.InvitationWhereInput, take: number) {
    return this.txHost.tx.invitation.findMany({ where, include: invitationWithOrganization, orderBy: { id: 'desc' }, take });
  }

  createOrganization(data: { partyId: string; type: OrganizationType; name: string; status: OrganizationStatus }) {
    return this.txHost.tx.organization.create({ data });
  }
}
