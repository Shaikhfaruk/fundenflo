import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { type OrganizationStatus, type PartnerKind, type PartnerLevel, PartnerVerificationStatus, VerificationDecision } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { PartnerVerificationEvent, partnerVerificationMachine } from '../../../engines/state-machines/machines/partner-verification.machine.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { OrganizationService } from '../../access/application/organization.service.js';
import { MembershipService } from '../../access/application/membership.service.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { PartnerRepository } from '../infrastructure/partner.repository.js';
import { toPartnerView } from './partner.views.js';
import { PartnerKycService } from './partner-kyc.service.js';

export type PartnerFilters = PageQuery & { verificationStatus?: PartnerVerificationStatus; organizationStatus?: OrganizationStatus; kind?: PartnerKind; level?: PartnerLevel; q?: string };

@Injectable()
export class PartnerAdminService {
  constructor(
    private readonly kyc: PartnerKycService,
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly partners: PartnerRepository,
    private readonly organizations: OrganizationService,
    private readonly memberships: MembershipService,
    private readonly changes: ChangeRecorder,
  ) {}

  async list(filters: PartnerFilters) {
    const window = pageWindow(filters);
    const where: Prisma.PartnerProfileWhereInput = {
      id: window.idFilter,
      verificationStatus: filters.verificationStatus,
      kind: filters.kind,
      level: filters.level,
      organization: { status: filters.organizationStatus, ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}) },
    };
    return toPage(await this.partners.list(where, window.take), filters.limit, toPartnerView);
  }

  async get(id: string, ability: AppAbility) {
    const partner = await this.require(id);
    return { ...(await this.kyc.profileOf(partner.organizationId)), members: await this.memberships.listMembers(partner.organizationId, ability) };
  }

  verify(id: string, decision: VerificationDecision, note: string, actor: UserActor) {
    return this.txHost.withTransaction(async () => {
      const partner = await this.require(id);
      const now = new Date();
      if (partner.verificationStatus === PartnerVerificationStatus.pending) {
        const next = this.transition(partner.verificationStatus, PartnerVerificationEvent.Recommend);
        await this.guarded(partner.id, partner.verificationStatus, { verificationStatus: next, recommendedDecision: decision, recommendedByUserId: actor.userId, recommendationNote: note, recommendedAt: now });
        await this.changes.record({
          action: AuditAction.PartnerVerificationRecommended,
          entityType: AuditEntity.PartnerProfile,
          entityId: partner.id,
          event: EventName.PartnerVerificationRecommended,
          metadata: { decision, note },
          payload: { partnerId: partner.id, organizationId: partner.organizationId, decision },
        });
        return toPartnerView(await this.require(id));
      }
      if (partner.verificationStatus === PartnerVerificationStatus.in_review && partner.recommendedByUserId === actor.userId) throw new AppError(ErrorCode.SELF_APPROVAL_NOT_ALLOWED);
      const approve = decision === VerificationDecision.approve;
      const next = this.transition(partner.verificationStatus, approve ? PartnerVerificationEvent.Approve : PartnerVerificationEvent.Reject);
      await this.guarded(partner.id, partner.verificationStatus, { verificationStatus: next, decidedByUserId: actor.userId, decisionNote: note, decidedAt: now });
      if (approve) await this.organizations.activate(partner.organizationId, actor.userId);
      else await this.organizations.close(partner.organizationId);
      await this.changes.record({
        action: approve ? AuditAction.PartnerVerified : AuditAction.PartnerRejected,
        entityType: AuditEntity.PartnerProfile,
        entityId: partner.id,
        event: approve ? EventName.PartnerVerified : EventName.PartnerRejected,
        metadata: { decision, note, recommendedDecision: partner.recommendedDecision, recommendedByUserId: partner.recommendedByUserId },
        payload: { partnerId: partner.id, organizationId: partner.organizationId, ownerUserId: partner.signedUpByUserId },
      });
      return toPartnerView(await this.require(id));
    });
  }

  setLevel(id: string, level: PartnerLevel, note: string) {
    return this.txHost.withTransaction(async () => {
      const partner = await this.require(id);
      const result = await this.partners.updateVersioned(partner.id, partner.version, { level });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: partner.version + 1 } });
      await this.changes.record({
        action: AuditAction.PartnerLevelChanged,
        entityType: AuditEntity.PartnerProfile,
        entityId: partner.id,
        event: EventName.PartnerLevelChanged,
        metadata: { from: partner.level, to: level, note },
        payload: { partnerId: partner.id, organizationId: partner.organizationId, level },
      });
      return toPartnerView(await this.require(id));
    });
  }

  suspend(id: string, note: string) {
    return this.changeOrganization(id, note, false);
  }

  reinstate(id: string, note: string) {
    return this.changeOrganization(id, note, true);
  }

  private changeOrganization(id: string, note: string, reinstate: boolean) {
    return this.txHost.withTransaction(async () => {
      const partner = await this.require(id);
      const change = reinstate ? await this.organizations.reinstate(partner.organizationId) : await this.organizations.suspend(partner.organizationId);
      await this.changes.record({
        action: reinstate ? AuditAction.PartnerReinstated : AuditAction.PartnerSuspended,
        entityType: AuditEntity.PartnerProfile,
        entityId: partner.id,
        event: reinstate ? EventName.PartnerReinstated : EventName.PartnerSuspended,
        metadata: { note, memberships: change.membershipIds.length },
        payload: { partnerId: partner.id, organizationId: partner.organizationId },
      });
      return toPartnerView(await this.require(id));
    });
  }

  private async guarded(id: string, from: PartnerVerificationStatus, data: Prisma.PartnerProfileUpdateManyMutationInput) {
    const result = await this.partners.updateFromStatus(id, from, data);
    if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
  }

  private transition(state: PartnerVerificationStatus, event: PartnerVerificationEvent): PartnerVerificationStatus {
    return transitionOrThrow(partnerVerificationMachine, state, event);
  }

  private async require(id: string) {
    const partner = await this.partners.findById(id);
    if (!partner) throw new AppError(ErrorCode.NOT_FOUND);
    return partner;
  }
}
