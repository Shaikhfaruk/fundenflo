import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { FraudDecision, FraudReviewStatus, RiskSignalStatus, type RiskSeverity, type RiskSignalKind, RiskSource, type RiskSubjectType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { HOLD_SEVERITIES, REVIEW_SIGNALS_LIMIT, SEVERITY_RANK } from '../domain/risk.constants.js';
import { RiskRepository } from '../infrastructure/risk.repository.js';
import { toReviewView, toSignalView } from './risk.views.js';

export type SignalInput = {
  kind: RiskSignalKind;
  severity: RiskSeverity;
  ruleKey: string;
  subject: { type: RiskSubjectType; id: string };
  partyId?: string | null;
  applicationId?: string | null;
  organizationId?: string | null;
  evidence: Record<string, unknown>;
  fingerprint: string;
  source?: RiskSource;
};

export type SignalFilters = { kind?: RiskSignalKind; severity?: RiskSeverity; status?: RiskSignalStatus; applicationId?: string; partyId?: string };

export type HoldScope = { applicationId?: string; partyIds?: string[]; organizationIds?: string[] };

const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class RiskService {
  constructor(
    private readonly risk: RiskRepository,
    private readonly changes: ChangeRecorder,
  ) {}

  @Transactional()
  async raise(input: SignalInput) {
    if (await this.risk.findOpenSignal(input.fingerprint)) return null;
    const existing = await this.risk.findOpenReview(input.subject.type, input.subject.id);
    const review =
      existing ??
      (await this.risk.createReview({ subjectType: input.subject.type, subjectId: input.subject.id, partyId: input.partyId ?? null, applicationId: input.applicationId ?? null, organizationId: input.organizationId ?? null, highestSeverity: input.severity }));
    if (existing && SEVERITY_RANK[input.severity] > SEVERITY_RANK[existing.highestSeverity]) await this.risk.updateReview(existing.id, FraudReviewStatus.open, { highestSeverity: input.severity });
    const signal = await this.risk.createSignal({
      reviewId: review.id,
      kind: input.kind,
      severity: input.severity,
      source: input.source ?? RiskSource.rule,
      ruleKey: input.ruleKey,
      subjectType: input.subject.type,
      subjectId: input.subject.id,
      partyId: input.partyId ?? null,
      applicationId: input.applicationId ?? null,
      organizationId: input.organizationId ?? null,
      evidence: json(input.evidence),
      fingerprint: input.fingerprint,
    });
    await this.changes.record({
      action: AuditAction.RiskSignalRaised,
      entityType: AuditEntity.RiskSignal,
      entityId: signal.id,
      event: EventName.RiskSignalRaised,
      metadata: { kind: signal.kind, severity: signal.severity, ruleKey: signal.ruleKey, subjectType: signal.subjectType, subjectId: signal.subjectId },
      payload: { signalId: signal.id, reviewId: review.id, kind: signal.kind, severity: signal.severity, applicationId: signal.applicationId, partyId: signal.partyId, organizationId: signal.organizationId },
    });
    return signal;
  }

  async signals(ability: AppAbility, query: PageQuery & SignalFilters) {
    const window = pageWindow(query);
    const rows = await this.risk.listSignals({ AND: [accessibleBy(ability, AppAction.Read).ofType('RiskSignal'), { id: window.idFilter, kind: query.kind, severity: query.severity, status: query.status, applicationId: query.applicationId, partyId: query.partyId }] }, window.take);
    return toPage(rows, query.limit, toSignalView);
  }

  async reviews(ability: AppAbility, query: PageQuery & { status?: FraudReviewStatus }) {
    const window = pageWindow(query);
    const rows = await this.risk.listReviews({ AND: [accessibleBy(ability, AppAction.Read).ofType('FraudReview'), { id: window.idFilter, status: query.status }] }, window.take);
    return toPage(rows, query.limit, toReviewView);
  }

  async review(id: string, ability: AppAbility) {
    const review = await this.risk.findReview({ AND: [accessibleBy(ability, AppAction.Read).ofType('FraudReview'), { id }] }, REVIEW_SIGNALS_LIMIT);
    if (!review) throw new AppError(ErrorCode.NOT_FOUND);
    return { ...toReviewView(review), signals: review.signals.map(toSignalView) };
  }

  @Transactional()
  async decide(id: string, input: { decision: FraudDecision; note: string; expectedVersion?: number }, actor: UserActor, ability: AppAbility) {
    await this.risk.lockReview(id);
    const review = await this.risk.findReview({ AND: [accessibleBy(ability, AppAction.Update).ofType('FraudReview'), { id }] }, REVIEW_SIGNALS_LIMIT);
    if (!review) throw new AppError(ErrorCode.NOT_FOUND);
    assertVersion(input.expectedVersion, review.version);
    if (review.status !== FraudReviewStatus.open) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: review.status, event: 'decide', allowed: [] } });
    const moved = await this.risk.updateReview(id, FraudReviewStatus.open, { status: FraudReviewStatus.decided, decision: input.decision, note: input.note, decidedByUserId: actor.userId, decidedAt: new Date() });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.risk.updateSignalsOfReview(id, input.decision === FraudDecision.confirmed ? RiskSignalStatus.confirmed : RiskSignalStatus.dismissed);
    await this.changes.record({
      action: AuditAction.FraudReviewDecided,
      entityType: AuditEntity.FraudReview,
      entityId: id,
      event: EventName.FraudReviewDecided,
      metadata: { decision: input.decision, note: input.note, subjectType: review.subjectType, subjectId: review.subjectId },
      payload: { reviewId: id, decision: input.decision, applicationId: review.applicationId, partyId: review.partyId, organizationId: review.organizationId },
    });
    return this.review(id, ability);
  }

  async holds(scope: HoldScope) {
    const subjects: Prisma.FraudReviewWhereInput[] = [
      ...(scope.applicationId ? [{ applicationId: scope.applicationId }] : []),
      ...(scope.partyIds?.length ? [{ partyId: { in: scope.partyIds } }] : []),
      ...(scope.organizationIds?.length ? [{ organizationId: { in: scope.organizationIds } }] : []),
    ];
    if (subjects.length === 0) return [];
    const rows = await this.risk.listReviews({ AND: [{ OR: subjects }, { OR: [{ status: FraudReviewStatus.open, highestSeverity: { in: [...HOLD_SEVERITIES] } }, { status: FraudReviewStatus.decided, decision: FraudDecision.confirmed }] }] }, REVIEW_SIGNALS_LIMIT);
    return rows.map((row) => ({ reviewId: row.id, status: row.status, decision: row.decision, highestSeverity: row.highestSeverity }));
  }

  async assertClear(scope: HoldScope) {
    const holds = await this.holds(scope);
    if (holds.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'risk', code: 'risk_hold', message: `fraud review ${holds[0]?.reviewId} must be cleared first` }] });
  }
}
