import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { EventName } from '../../../common/events/event-names.js';
import {
  ContactType,
  InvitationStatus,
  NotificationChannel,
  OrganizationStatus,
  type Role,
  SessionContext,
} from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { randomToken, sha256 } from '../../../infrastructure/crypto/secure-random.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { JobPriority } from '../../../infrastructure/queue/queue.constants.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { ContactCodec } from '../../parties/application/contact-codec.service.js';
import { AppAction, type AppAbility } from '../domain/ability.types.js';
import { INVITATION_TOKEN_BYTES, INVITATION_TTL_DAYS, ORGANIZATION_CONTEXT } from '../domain/access.constants.js';
import { assertRoleAllowed } from '../domain/role-rules.js';
import { AccessRepository, type InvitationWithOrganization } from '../infrastructure/access.repository.js';
import { toInvitationView } from './access.views.js';

export type InvitationInput = {
  organizationId: string;
  role: Role;
  recipient: { channel: typeof ContactType.mobile | typeof ContactType.email; value: string };
};

export type CreatedInvitation = {
  invitation: InvitationWithOrganization;
  recipient: string;
  token: string | null;
};

export type InvitationFilters = PageQuery & {
  organizationId?: string;
  status?: InvitationStatus;
};

@Injectable()
export class InvitationService {
  constructor(
    private readonly repository: AccessRepository,
    private readonly codec: ContactCodec,
    private readonly notifications: NotificationService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  @Transactional()
  async create(input: InvitationInput, invitedByUserId: string | null, ability: AppAbility): Promise<CreatedInvitation> {
    const organization = await this.repository.findOrganization(input.organizationId);
    if (!organization) throw new AppError(ErrorCode.NOT_FOUND, { details: { organizationId: input.organizationId } });
    if (organization.status !== OrganizationStatus.active) throw new AppError(ErrorCode.ORGANIZATION_INACTIVE);
    const context = ORGANIZATION_CONTEXT[organization.type];
    assertRoleAllowed(context, input.role);
    if (context === SessionContext.staff && input.recipient.channel !== ContactType.email) {
      throw new AppError(ErrorCode.INVITATION_CHANNEL_NOT_ALLOWED);
    }
    const candidate = { organizationId: organization.id, role: input.role, context, organization: { type: organization.type } };
    if (!ability.can(AppAction.Create, subject('Invitation', candidate as never))) throw new AppError(ErrorCode.FORBIDDEN);

    const encoded = this.codec.encode(input.recipient.channel, input.recipient.value, CipherPurpose.InvitationIdentifier);
    const token = input.recipient.channel === ContactType.email ? randomToken(INVITATION_TOKEN_BYTES) : null;
    await this.repository.revokePendingDuplicates({
      organizationId: organization.id,
      role: input.role,
      channel: input.recipient.channel,
      identifierHash: encoded.hash,
    });
    const invitation = await this.repository.createInvitation({
      organizationId: organization.id,
      context,
      role: input.role,
      channel: input.recipient.channel,
      identifierHash: encoded.hash,
      identifierEnc: encoded.encrypted,
      identifierMasked: encoded.masked,
      tokenHash: token ? sha256(token) : null,
      invitedByUserId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 3600_000),
    });
    await this.outbox.publish({
      name: EventName.InvitationCreated,
      aggregateType: 'invitation',
      aggregateId: invitation.id,
      payload: { invitationId: invitation.id, organizationId: organization.id, context, role: input.role, channel: invitation.channel },
    });
    await this.audit.record({
      action: AuditAction.InvitationCreated,
      entityType: AuditEntity.Invitation,
      entityId: invitation.id,
      metadata: { organizationId: organization.id, role: input.role, channel: invitation.channel, recipient: invitation.identifierMasked },
    });
    return { invitation, recipient: input.recipient.value, token };
  }

  async deliver(created: CreatedInvitation): Promise<void> {
    const { invitation, recipient, token } = created;
    const expiresOn = invitation.expiresAt.toISOString().slice(0, 10);
    if (invitation.context === SessionContext.staff && token) {
      await this.notifications.send({
        templateKey: NotificationTemplateKey.InvitationStaff,
        channel: NotificationChannel.email,
        recipient,
        params: { role: invitation.role, token, expiresOn },
        priority: JobPriority.High,
      });
      return;
    }
    await this.notifications.send({
      templateKey: NotificationTemplateKey.InvitationMember,
      channel: invitation.channel === ContactType.mobile ? NotificationChannel.sms : NotificationChannel.email,
      recipient,
      params: { organization: invitation.organization.name, role: invitation.role, expiresOn },
      priority: JobPriority.High,
    });
  }

  async list(filters: InvitationFilters, ability: AppAbility) {
    const window = pageWindow(filters);
    const where: Prisma.InvitationWhereInput = {
      AND: [
        accessibleBy(ability, AppAction.Read).ofType('Invitation'),
        { id: window.idFilter, organizationId: filters.organizationId, status: filters.status },
      ],
    };
    const rows = await this.repository.listInvitations(where, window.take);
    return toPage(rows, filters.limit, toInvitationView);
  }

  @Transactional()
  async revoke(id: string, ability: AppAbility) {
    const invitation = await this.repository.findInvitation(id);
    if (!invitation) throw new AppError(ErrorCode.NOT_FOUND);
    if (!ability.can(AppAction.Update, subject('Invitation', invitation as never))) throw new AppError(ErrorCode.FORBIDDEN);
    if (invitation.status !== InvitationStatus.pending) throw new AppError(ErrorCode.INVITATION_INVALID);
    const revoked = await this.repository.updateInvitation(id, { status: InvitationStatus.revoked, revokedAt: new Date() });
    await this.outbox.publish({ name: EventName.InvitationRevoked, aggregateType: 'invitation', aggregateId: id, payload: { invitationId: id } });
    await this.audit.record({ action: AuditAction.InvitationRevoked, entityType: AuditEntity.Invitation, entityId: id });
    return revoked;
  }

  async acceptPendingForContact(userId: string, channel: ContactType, identifierHash: string, context: SessionContext) {
    const invitations = await this.repository.findAcceptableInvitations(channel, identifierHash, context);
    for (const invitation of invitations) await this.accept(invitation, userId);
    return invitations.length;
  }

  async hasAcceptable(channel: ContactType, identifierHash: string, context: SessionContext): Promise<boolean> {
    return (await this.repository.findAcceptableInvitations(channel, identifierHash, context)).length > 0;
  }

  async findAcceptableByToken(token: string): Promise<InvitationWithOrganization> {
    const invitation = await this.repository.findInvitationByToken(sha256(token));
    const usable =
      invitation &&
      invitation.status === InvitationStatus.pending &&
      invitation.expiresAt > new Date() &&
      invitation.organization.status === OrganizationStatus.active;
    if (!usable) throw new AppError(ErrorCode.INVITATION_INVALID);
    return invitation;
  }

  decryptRecipient(invitation: InvitationWithOrganization): string {
    return this.codec.decrypt(invitation.identifierEnc, CipherPurpose.InvitationIdentifier);
  }

  async accept(invitation: InvitationWithOrganization, userId: string) {
    const membership = await this.repository.upsertOrganizationMembership({
      userId,
      organizationId: invitation.organizationId,
      role: invitation.role,
      context: invitation.context,
      approvedByUserId: invitation.invitedByUserId,
    });
    await this.repository.updateInvitation(invitation.id, {
      status: InvitationStatus.accepted,
      acceptedAt: new Date(),
      acceptedUserId: userId,
    });
    await this.outbox.publish({
      name: EventName.InvitationAccepted,
      aggregateType: 'invitation',
      aggregateId: invitation.id,
      payload: { invitationId: invitation.id, userId, membershipId: membership.id },
    });
    await this.audit.record({
      action: AuditAction.InvitationAccepted,
      entityType: AuditEntity.Invitation,
      entityId: invitation.id,
      metadata: { userId, membershipId: membership.id },
    });
    return membership;
  }
}
