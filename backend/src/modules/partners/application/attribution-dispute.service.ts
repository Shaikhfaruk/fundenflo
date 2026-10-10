import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { AttributionKind, DisputeOutcome, type DisputeSource, DisputeStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { AttributionDispute, LeadAttribution } from '../../../generated/prisma/client.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { AttributionEndReason } from '../domain/partner.constants.js';
import { LeadAttributionRepository } from '../infrastructure/lead-attribution.repository.js';
import { LeadAttributionService } from './lead-attribution.service.js';

export type DisputeClaim = { attribution: LeadAttribution; claimantOrganizationId: string; source: DisputeSource; referralCodeId?: string | null; note?: string | null; raisedByUserId?: string | null };

export type DisputeResolution = { outcome: DisputeOutcome; note: string; expectedVersion?: number };

const iso = (value: Date | null) => value?.toISOString() ?? null;

const toDisputeView = (dispute: AttributionDispute & { attribution: LeadAttribution }) => ({
  id: dispute.id,
  leadId: dispute.leadId,
  attribution: { id: dispute.attribution.id, organizationId: dispute.attribution.organizationId, kind: dispute.attribution.kind, protectedUntil: dispute.attribution.protectedUntil.toISOString(), disputedAt: iso(dispute.attribution.disputedAt), endedAt: iso(dispute.attribution.endedAt) },
  holderOrganizationId: dispute.holderOrganizationId,
  claimantOrganizationId: dispute.claimantOrganizationId,
  source: dispute.source,
  referralCodeId: dispute.referralCodeId,
  claimNote: dispute.claimNote,
  status: dispute.status,
  outcome: dispute.outcome,
  resolutionNote: dispute.resolutionNote,
  resolvedAt: iso(dispute.resolvedAt),
  version: dispute.version,
  createdAt: dispute.createdAt.toISOString(),
});

@Injectable()
export class AttributionDisputeService {
  constructor(
    private readonly repository: LeadAttributionRepository,
    private readonly attributions: LeadAttributionService,
    private readonly changes: ChangeRecorder,
  ) {}

  @Transactional()
  async raise(claim: DisputeClaim) {
    if (claim.attribution.organizationId === claim.claimantOrganizationId) return null;
    const existing = await this.repository.findOpenDispute(claim.attribution.id, claim.claimantOrganizationId);
    if (existing) return existing;
    await this.repository.lock(claim.attribution.id);
    const dispute = await this.repository.createDispute({
      attributionId: claim.attribution.id,
      leadId: claim.attribution.leadId,
      holderOrganizationId: claim.attribution.organizationId,
      claimantOrganizationId: claim.claimantOrganizationId,
      source: claim.source,
      referralCodeId: claim.referralCodeId ?? null,
      claimNote: claim.note ?? null,
      raisedByUserId: claim.raisedByUserId ?? null,
    });
    if (!claim.attribution.disputedAt) await this.repository.update(claim.attribution.id, { disputedAt: new Date() });
    await this.changes.record({
      action: AuditAction.AttributionDisputed,
      entityType: AuditEntity.AttributionDispute,
      entityId: dispute.id,
      event: EventName.AttributionDisputed,
      metadata: { leadId: dispute.leadId, holderOrganizationId: dispute.holderOrganizationId, claimantOrganizationId: dispute.claimantOrganizationId, source: dispute.source },
      payload: { disputeId: dispute.id, leadId: dispute.leadId, attributionId: dispute.attributionId, holderOrganizationId: dispute.holderOrganizationId, claimantOrganizationId: dispute.claimantOrganizationId },
    });
    return dispute;
  }

  async list(ability: AppAbility, query: PageQuery & { status?: DisputeStatus }) {
    const window = pageWindow(query);
    const rows = await this.repository.listDisputes({ AND: [accessibleBy(ability, AppAction.Read).ofType('AttributionDispute'), { id: window.idFilter, status: query.status }] }, window.take);
    return toPage(rows, query.limit, toDisputeView);
  }

  @Transactional()
  async resolve(id: string, input: DisputeResolution, actor: UserActor, ability: AppAbility) {
    await this.repository.lockDispute(id);
    const dispute = await this.repository.findDispute({ AND: [accessibleBy(ability, AppAction.Update).ofType('AttributionDispute'), { id }] });
    if (!dispute) throw new AppError(ErrorCode.NOT_FOUND);
    assertVersion(input.expectedVersion, dispute.version);
    if (dispute.status !== DisputeStatus.open) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: dispute.status, event: 'resolve', allowed: [] } });
    await this.repository.lock(dispute.attributionId);
    const moved = await this.repository.updateDisputeFromStatus(id, DisputeStatus.open, { status: DisputeStatus.resolved, outcome: input.outcome, resolutionNote: input.note, resolvedByUserId: actor.userId, resolvedAt: new Date() });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    const stillDisputed = (await this.repository.countOpenDisputes(dispute.attributionId)) > 0;
    if (input.outcome === DisputeOutcome.transfer) {
      await this.repository.update(dispute.attributionId, {
        organizationId: dispute.claimantOrganizationId,
        kind: dispute.referralCodeId ? AttributionKind.referral_code : AttributionKind.referral,
        referralCodeId: dispute.referralCodeId,
        protectedUntil: this.attributions.protectedUntil(),
        disputedAt: stillDisputed ? dispute.attribution.disputedAt : null,
      });
    } else if (input.outcome === DisputeOutcome.void) {
      await this.repository.update(dispute.attributionId, { endedAt: new Date(), endReason: AttributionEndReason.Void, disputedAt: null });
    } else if (!stillDisputed) {
      await this.repository.update(dispute.attributionId, { disputedAt: null });
    }
    await this.changes.record({
      action: AuditAction.AttributionDisputeResolved,
      entityType: AuditEntity.AttributionDispute,
      entityId: id,
      event: EventName.AttributionDisputeResolved,
      metadata: { leadId: dispute.leadId, outcome: input.outcome, note: input.note, from: dispute.holderOrganizationId, claimant: dispute.claimantOrganizationId },
      payload: { disputeId: id, leadId: dispute.leadId, attributionId: dispute.attributionId, outcome: input.outcome, holderOrganizationId: dispute.holderOrganizationId, claimantOrganizationId: dispute.claimantOrganizationId },
    });
    const resolved = await this.repository.findDispute({ id });
    return resolved ? toDisputeView(resolved) : null;
  }
}
