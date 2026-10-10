import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';

import { AnalysisStatus, ConfigResource } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { isUniqueViolation } from '../../../infrastructure/database/prisma-errors.js';
import type { CompiledScoringModel } from '../../../engines/scoring/scoring.types.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { ApplicationService } from '../../applications/application/application.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';
import { DocumentService } from '../../documents/application/document.service.js';
import { ANALYSIS_DOCUMENTS_MAX, AnalysisSkipReason, AnalysisStepKey, AnalysisStepState, RecomputeMode } from '../domain/assessment.constants.js';
import { AssessmentRepository } from '../infrastructure/assessment.repository.js';
import { type AnalysisStep, toAnalysisView, toAssessmentView } from './assessment.views.js';
import { ScoringService } from './scoring.service.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;

const initialSteps = (): AnalysisStep[] => [AnalysisStepKey.Documents, AnalysisStepKey.Score].map((key) => ({ key, state: AnalysisStepState.Pending, detail: null }));

const withStep = (steps: AnalysisStep[], key: AnalysisStepKey, state: AnalysisStepState, detail: Record<string, unknown> | null = null) => steps.map((step) => (step.key === key ? { ...step, state, detail } : step));

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly repository: AssessmentRepository,
    private readonly applications: ApplicationService,
    private readonly documents: DocumentService,
    private readonly consents: ConsentService,
    private readonly scoring: ScoringService,
    private readonly config: ConfigPublishingService,
    private readonly changes: ChangeRecorder,
    private readonly auditLog: AuditService,
  ) {}

  async request(applicationId: string, input: { documentIds?: string[] }, userId: string, ability: AppAbility, locale: Locale) {
    const application = await this.applications.openForChange(applicationId, ability);
    if (!(await this.consents.hasConsent(application.actingPartyId, ConsentPurposeKey.AiDocuments))) throw new AppError(ErrorCode.CONSENT_REQUIRED, { details: { purpose: ConsentPurposeKey.AiDocuments } });
    const open = await this.repository.openAnalysis(applicationId);
    if (open) return toAnalysisView(open, locale);
    const available = (await this.documents.analysable(application.partyId, applicationId)).map((document) => document.id);
    const unknown = (input.documentIds ?? []).filter((id) => !available.includes(id));
    if (unknown.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'documentIds', code: 'not_ready', message: `documents not ready for analysis: ${unknown.join(', ')}` }] });
    try {
      return toAnalysisView(await this.create(application.id, application.partyId, (input.documentIds ?? available).slice(0, ANALYSIS_DOCUMENTS_MAX), userId), locale);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.repository.openAnalysis(applicationId);
      if (!existing) throw error;
      return toAnalysisView(existing, locale);
    }
  }

  async get(id: string, ability: AppAbility, locale: Locale) {
    const analysis = await this.repository.findAnalysis(id);
    if (!analysis) throw new AppError(ErrorCode.NOT_FOUND);
    await this.applications.get(analysis.applicationId, ability);
    return toAnalysisView(analysis, locale);
  }

  async assessment(applicationId: string, ability: AppAbility, locale: Locale) {
    await this.applications.get(applicationId, ability);
    const result = await this.repository.latestScoreResult(applicationId);
    if (!result) throw new AppError(ErrorCode.NOT_FOUND, { details: { reason: 'not_assessed' } });
    return toAssessmentView(result, locale);
  }

  async run(id: string): Promise<AnalysisStatus | null> {
    const claimed = await this.claim(id);
    if (!claimed) return null;
    try {
      const application = await this.applications.subject(claimed.applicationId);
      const clean = new Set((await this.documents.analysable(application.partyId, application.id)).map((document) => document.id));
      let steps = withStep(claimed.steps, AnalysisStepKey.Documents, AnalysisStepState.Done, { documents: claimed.documentIds.filter((documentId) => clean.has(documentId)).length });
      steps = withStep(steps, AnalysisStepKey.Score, AnalysisStepState.Active);
      await this.repository.updateAnalysis(id, { steps: json(steps) });
      const model = await this.scoring.modelFor(application.segmentKey, application.subSegmentKey);
      if (!model) return await this.finish(id, withStep(steps, AnalysisStepKey.Score, AnalysisStepState.Skipped, { reason: AnalysisSkipReason.NoScoringModel }), null);
      const result = await this.scoring.score(application, model, claimed.requestedByUserId);
      return await this.finish(id, withStep(steps, AnalysisStepKey.Score, AnalysisStepState.Done, { status: result.status, value: result.value, model: model.key }), result.id);
    } catch (error) {
      this.logger.error({ err: error, analysisId: id }, 'Analysis failed');
      await this.fail(id, error instanceof AppError ? error.code : 'internal_error');
      return AnalysisStatus.failed;
    }
  }

  async recompute(scoreResultId: string, mode: RecomputeMode, userId: string, ability: AppAbility, locale: Locale) {
    const original = await this.repository.findScoreResult(scoreResultId);
    if (!original) throw new AppError(ErrorCode.NOT_FOUND);
    const application = await this.applications.get(original.applicationId, ability);
    if (mode === RecomputeMode.Reproduce) {
      const pinned = await this.config.pinnedVersion<CompiledScoringModel>(ConfigResource.scoring_model, original.modelVersionId);
      if (!pinned) throw new AppError(ErrorCode.NOT_FOUND, { details: { reason: 'model_version_missing' } });
      const outcome = this.scoring.reproduce(pinned.compiled, original.inputs as Record<string, { value: unknown; rank: number } | null>, original.consents as Record<string, boolean>);
      await this.audit(scoreResultId, mode, { matches: outcome.value === original.value && outcome.status === original.status });
      return { mode, matches: outcome.value === original.value && outcome.status === original.status, original: { status: original.status, value: original.value }, recomputed: { status: outcome.status, value: outcome.value, factors: outcome.factors } };
    }
    const subject = await this.applications.subject(application.id);
    const model = await this.scoring.modelFor(subject.segmentKey, subject.subSegmentKey);
    if (!model) throw new AppError(ErrorCode.NOT_FOUND, { details: { reason: AnalysisSkipReason.NoScoringModel } });
    const result = await this.scoring.score(subject, model, userId);
    await this.audit(scoreResultId, mode, { newScoreResultId: result.id });
    const fresh = await this.repository.findScoreResult(result.id);
    if (!fresh) throw new AppError(ErrorCode.NOT_FOUND);
    return { mode, previous: { id: original.id, status: original.status, value: original.value }, assessment: toAssessmentView(fresh, locale) };
  }

  @Transactional()
  private async create(applicationId: string, partyId: string, documentIds: string[], userId: string) {
    const analysis = await this.repository.createAnalysis({ applicationId, partyId, documentIds, requestedByUserId: userId, steps: json(initialSteps()) });
    await this.changes.record({
      action: AuditAction.AnalysisRequested,
      entityType: AuditEntity.Analysis,
      entityId: analysis.id,
      event: EventName.AnalysisRequested,
      metadata: { applicationId, documents: documentIds.length },
      payload: { analysisId: analysis.id, applicationId, requestedByUserId: userId },
    });
    return analysis;
  }

  @Transactional()
  private async claim(id: string) {
    await this.repository.lockAnalysis(id);
    const analysis = await this.repository.findAnalysis(id);
    if (analysis?.status !== AnalysisStatus.queued) return null;
    const steps = withStep(analysis.steps as AnalysisStep[], AnalysisStepKey.Documents, AnalysisStepState.Active);
    await this.repository.updateAnalysis(id, { status: AnalysisStatus.running, startedAt: new Date(), steps: json(steps) });
    return { ...analysis, steps };
  }

  @Transactional()
  private async finish(id: string, steps: AnalysisStep[], scoreResultId: string | null) {
    const analysis = await this.repository.findAnalysis(id);
    await this.repository.updateAnalysis(id, { status: AnalysisStatus.done, finishedAt: new Date(), steps: json(steps), scoreResultId });
    await this.changes.record({
      action: AuditAction.AnalysisCompleted,
      entityType: AuditEntity.Analysis,
      entityId: id,
      event: EventName.AnalysisCompleted,
      metadata: { scoreResultId },
      payload: { analysisId: id, applicationId: analysis?.applicationId, requestedByUserId: analysis?.requestedByUserId, status: AnalysisStatus.done, scoreResultId },
    });
    return AnalysisStatus.done;
  }

  @Transactional()
  private async fail(id: string, reason: string) {
    const analysis = await this.repository.findAnalysis(id);
    const steps = ((analysis?.steps ?? []) as AnalysisStep[]).map((step) => (step.state === AnalysisStepState.Active ? { ...step, state: AnalysisStepState.Failed } : step));
    await this.repository.updateAnalysis(id, { status: AnalysisStatus.failed, finishedAt: new Date(), failureReason: reason, steps: json(steps) });
    await this.changes.record({
      action: AuditAction.AnalysisCompleted,
      entityType: AuditEntity.Analysis,
      entityId: id,
      event: EventName.AnalysisCompleted,
      metadata: { failed: true, reason },
      payload: { analysisId: id, applicationId: analysis?.applicationId, requestedByUserId: analysis?.requestedByUserId, status: AnalysisStatus.failed },
    });
  }

  private async audit(scoreResultId: string, mode: RecomputeMode, metadata: Record<string, unknown>) {
    await this.auditLog.record({ action: AuditAction.AssessmentRecomputed, entityType: AuditEntity.ScoreResult, entityId: scoreResultId, metadata: { mode, ...metadata } });
  }
}
