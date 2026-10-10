import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { MatchReviewStatus, PartyStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { MatchReviewDecision } from '../domain/party.constants.js';
import type { MergeIssue } from '../domain/party-merge.types.js';
import { PartyRepository } from '../infrastructure/party.repository.js';
import { PartyMergeRegistry } from './party-merge.registry.js';
import { toMatchReviewView, toMergeView, toPartySummary } from './party-merge.views.js';

export type MergeRequest = { sourcePartyId: string; targetPartyId: string; reason: string; reviewId?: string };

@Injectable()
export class PartyMergeService {
  constructor(
    private readonly parties: PartyRepository,
    private readonly registry: PartyMergeRegistry,
    private readonly changes: ChangeRecorder,
  ) {}

  @Transactional()
  async merge(request: MergeRequest, actorUserId: string) {
    const { sourcePartyId: sourceId, targetPartyId: targetId } = request;
    if (sourceId === targetId) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'mergedPartyId', code: 'same_party', message: 'choose two different parties' }] });
    await this.parties.lockParties([sourceId, targetId]);
    const found = await this.parties.findWithLinks([sourceId, targetId]);
    const source = found.find((party) => party.id === sourceId);
    const target = found.find((party) => party.id === targetId);
    if (!source || !target) throw new AppError(ErrorCode.NOT_FOUND);
    const issues: MergeIssue[] = [];
    if (source.status !== PartyStatus.active || target.status !== PartyStatus.active) issues.push({ path: 'parties', code: 'not_active', message: 'only active parties can be merged' });
    if (source.kind !== target.kind) issues.push({ path: 'parties', code: 'kind_mismatch', message: 'a person cannot be merged with a business' });
    for (const [, participant] of this.registry.all()) issues.push(...((await participant.check?.({ sourceId, targetId })) ?? []));
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });

    const snapshot: Record<string, unknown> = {};
    for (const [key, participant] of this.registry.all()) snapshot[key] = (await participant.merge({ sourceId, targetId })) ?? null;
    await this.parties.setMerged(sourceId, targetId);
    const merge = await this.parties.createMerge({ sourcePartyId: sourceId, targetPartyId: targetId, reason: request.reason, snapshot: snapshot as Prisma.InputJsonValue, mergedByUserId: actorUserId });
    await this.parties.resolveOpenReviewsFor(sourceId, `merged:${merge.id}`, actorUserId);
    const details = { mergeId: merge.id, sourcePartyId: sourceId, targetPartyId: targetId, partyId: targetId, reviewId: request.reviewId ?? null };
    await this.changes.record({ action: AuditAction.PartyMerged, entityType: AuditEntity.PartyMerge, entityId: merge.id, event: EventName.PartyMerged, metadata: { ...details, reason: request.reason }, payload: details });
    return toMergeView(merge);
  }

  @Transactional()
  async revert(mergeId: string, reason: string, actorUserId: string) {
    const merge = await this.parties.findMerge(mergeId);
    if (!merge) throw new AppError(ErrorCode.NOT_FOUND);
    if (merge.revertedAt) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: 'reverted', event: 'revert', allowed: [] } });
    await this.parties.lockParties([merge.sourcePartyId, merge.targetPartyId]);
    const found = await this.parties.findWithLinks([merge.sourcePartyId, merge.targetPartyId]);
    const source = found.find((party) => party.id === merge.sourcePartyId);
    const target = found.find((party) => party.id === merge.targetPartyId);
    if (source?.mergedIntoId !== merge.targetPartyId || target?.status !== PartyStatus.active) {
      throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: 'changed_since_merge', event: 'revert', allowed: [] } });
    }
    const snapshot = (merge.snapshot ?? {}) as Record<string, unknown>;
    const parties = { sourceId: merge.sourcePartyId, targetId: merge.targetPartyId };
    for (const [key, participant] of this.registry.all().toReversed()) await participant.revert(parties, snapshot[key] ?? null);
    await this.parties.setMerged(merge.sourcePartyId, null);
    const moved = await this.parties.markMergeReverted(merge.id, actorUserId);
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    const details = { mergeId: merge.id, sourcePartyId: merge.sourcePartyId, targetPartyId: merge.targetPartyId, partyId: merge.targetPartyId };
    await this.changes.record({ action: AuditAction.PartyMergeReverted, entityType: AuditEntity.PartyMerge, entityId: merge.id, event: EventName.PartyMergeReverted, metadata: { ...details, reason }, payload: details });
    const reverted = await this.parties.findMerge(merge.id);
    return reverted ? toMergeView(reverted) : null;
  }

  async listMerges(partyId: string | undefined, query: PageQuery) {
    const window = pageWindow(query);
    const where: Prisma.PartyMergeWhereInput = { id: window.idFilter, ...(partyId ? { OR: [{ sourcePartyId: partyId }, { targetPartyId: partyId }] } : {}) };
    return toPage(await this.parties.listMerges(where, window.take), query.limit, toMergeView);
  }

  async listReviews(status: MatchReviewStatus, query: PageQuery) {
    const window = pageWindow(query);
    return toPage(await this.parties.listMatchReviews({ status, id: window.idFilter }, window.take), query.limit, (review) => toMatchReviewView(review, []));
  }

  async getReview(id: string) {
    const review = await this.parties.findMatchReview(id);
    if (!review) throw new AppError(ErrorCode.NOT_FOUND);
    const parties = await this.parties.findWithLinks([review.partyId, ...review.candidatePartyIds]);
    return toMatchReviewView(review, parties.map(toPartySummary));
  }

  @Transactional()
  async resolveReview(id: string, decision: MatchReviewDecision, input: { survivorPartyId?: string; mergedPartyId?: string; note: string }, actorUserId: string) {
    const review = await this.parties.findMatchReview(id);
    if (!review) throw new AppError(ErrorCode.NOT_FOUND);
    if (review.status !== MatchReviewStatus.open) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: review.status, event: decision, allowed: [] } });
    if (decision === MatchReviewDecision.Merge) {
      const involved = new Set([review.partyId, ...review.candidatePartyIds]);
      if (!input.survivorPartyId || !input.mergedPartyId || !involved.has(input.survivorPartyId) || !involved.has(input.mergedPartyId)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'survivorPartyId', code: 'not_in_review', message: 'choose the survivor and the merged party from this review' }] });
      }
      await this.merge({ sourcePartyId: input.mergedPartyId, targetPartyId: input.survivorPartyId, reason: input.note, reviewId: id }, actorUserId);
      await this.parties.resolveMatchReview(id, MatchReviewStatus.linked, input.note, actorUserId);
    } else {
      const moved = await this.parties.resolveMatchReview(id, MatchReviewStatus.dismissed, input.note, actorUserId);
      if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    }
    const details = { reviewId: id, decision, partyId: review.partyId };
    await this.changes.record({ action: AuditAction.PartyMatchReviewResolved, entityType: AuditEntity.PartyMatchReview, entityId: id, event: EventName.PartyMatchReviewResolved, metadata: { ...details, note: input.note }, payload: details });
    return this.getReview(id);
  }
}
