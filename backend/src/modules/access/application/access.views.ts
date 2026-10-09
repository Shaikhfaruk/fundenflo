import type { ApiClient } from '../../../generated/prisma/client.js';
import type { InvitationWithOrganization, MemberWithUser, MembershipWithOrganization } from '../infrastructure/access.repository.js';

export type OrganizationSummaryView = {
  id: string;
  name: string;
  type: string;
  status: string;
};

export type MembershipView = {
  id: string;
  context: string;
  role: string;
  status: string;
  organization: OrganizationSummaryView | null;
  version: number;
  createdAt: string;
};

export type InvitationView = {
  id: string;
  organization: OrganizationSummaryView;
  context: string;
  role: string;
  channel: string;
  recipient: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export function toMembershipView(membership: MembershipWithOrganization): MembershipView {
  return {
    id: membership.id,
    context: membership.context,
    role: membership.role,
    status: membership.status,
    organization: membership.organization,
    version: membership.version,
    createdAt: membership.createdAt.toISOString(),
  };
}

export function toInvitationView(invitation: InvitationWithOrganization): InvitationView {
  return {
    id: invitation.id,
    organization: invitation.organization,
    context: invitation.context,
    role: invitation.role,
    channel: invitation.channel,
    recipient: invitation.identifierMasked,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

export function toMemberView(member: MemberWithUser) {
  return { ...toMembershipView(member), userId: member.userId, displayName: member.user.party.displayName, approvedAt: member.approvedAt?.toISOString() ?? null };
}

export const toApiClientView = (client: ApiClient) => ({
  id: client.id,
  name: client.name,
  keyPrefix: client.keyPrefix,
  scopes: client.scopes,
  leadSourceId: client.leadSourceId,
  status: client.status,
  lastUsedAt: client.lastUsedAt?.toISOString() ?? null,
  expiresAt: client.expiresAt?.toISOString() ?? null,
  revokedAt: client.revokedAt?.toISOString() ?? null,
  createdAt: client.createdAt.toISOString(),
});
