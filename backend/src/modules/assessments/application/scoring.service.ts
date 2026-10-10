import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ConfigResource, ScoreResultStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { stableStringify } from '../../../common/utils/stable-json.js';
import type { FactLookup } from '../../../engines/conditions/condition.types.js';
import type { RankedLookup } from '../../../engines/facts/resolve-fact.js';
import { buildImprovementPlan, renderImprovementText, scoreLookup } from '../../../engines/improvement/build-plan.js';
import type { CompiledImprovementRule } from '../../../engines/improvement/improvement.types.js';
import { computeScore, scoringAttributes } from '../../../engines/scoring/compute-score.js';
import type { CompiledScoringModel, ScoreOutcome } from '../../../engines/scoring/scoring.types.js';
import { selectScoringModel } from '../../../engines/scoring/select-model.js';
import { sha256 } from '../../../infrastructure/crypto/secure-random.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { FactService } from '../../attributes/application/fact.service.js';
import { ApplicationService } from '../../applications/application/application.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import type { PublishedConfig } from '../../config-publishing/domain/config.types.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { AssessmentRepository } from '../infrastructure/assessment.repository.js';

export type ScoringSubject = { id: string; partyId: string; actingPartyId: string; segmentKey: string; subSegmentKey: string | null };

const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class ScoringService {
  constructor(
    private readonly config: ConfigPublishingService,
    private readonly facts: FactService,
    private readonly consents: ConsentService,
    private readonly applications: ApplicationService,
    private readonly repository: AssessmentRepository,
    private readonly changes: ChangeRecorder,
  ) {}

  async modelFor(segment: string, subSegment: string | null): Promise<PublishedConfig<CompiledScoringModel> | null> {
    const published = await this.config.active<CompiledScoringModel>(ConfigResource.scoring_model);
    return selectScoringModel(published.map((entry) => ({ key: entry.key, model: entry.compiled, meta: entry })), segment, subSegment)?.meta ?? null;
  }

  async lookupFor(subject: ScoringSubject): Promise<RankedLookup> {
    const own = await this.facts.rankedLookup(subject.partyId);
    if (subject.actingPartyId === subject.partyId) return own;
    const acting = await this.facts.rankedLookup(subject.actingPartyId);
    return (attr) => own(attr) ?? acting(attr);
  }

  async consentsFor(subject: ScoringSubject, model: CompiledScoringModel): Promise<Record<string, boolean>> {
    const purposes = [...new Set(model.factors.flatMap((factor) => (factor.requiresConsent ? [factor.requiresConsent] : [])))];
    const summary = purposes.length > 0 ? await this.consents.summary(subject.actingPartyId, purposes) : new Map<string, { granted: boolean }>();
    return Object.fromEntries(purposes.map((purpose) => [purpose, summary.get(purpose)?.granted ?? false]));
  }

  @Transactional()
  async score(subject: ScoringSubject, model: PublishedConfig<CompiledScoringModel>, computedByUserId: string | null) {
    const lookup = await this.lookupFor(subject);
    const consents = await this.consentsFor(subject, model.compiled);
    const outcome = computeScore(model.compiled, lookup, (purpose) => consents[purpose] === true);
    const result = await this.repository.createScoreResult({
      applicationId: subject.id,
      partyId: subject.partyId,
      modelDocumentId: model.documentId,
      modelKey: model.key,
      modelVersionId: model.versionId,
      modelNumber: model.number,
      status: outcome.status,
      value: outcome.value,
      band: outcome.band ? json(outcome.band) : undefined,
      factors: json(outcome.factors),
      limitations: json(outcome.limitations),
      inputs: json(outcome.inputs),
      consents: json(consents),
      inputHash: sha256(stableStringify({ model: model.versionId, inputs: outcome.inputs, consents })),
      computedByUserId,
    });
    await this.improve(result.id, subject, outcome, (attr) => lookup(attr)?.value);
    await this.applications.recordAssessment(subject.id, result.id, outcome.status === ScoreResultStatus.scored);
    await this.changes.record({
      action: AuditAction.ScoreComputed,
      entityType: AuditEntity.ScoreResult,
      entityId: result.id,
      event: EventName.ScoreComputed,
      metadata: { applicationId: subject.id, model: model.key, number: model.number, status: outcome.status, value: outcome.value },
      payload: { applicationId: subject.id, partyId: subject.partyId, scoreResultId: result.id, status: outcome.status, value: outcome.value },
    });
    return result;
  }

  reproduce(model: CompiledScoringModel, inputs: Record<string, { value: unknown; rank: number } | null>, consents: Record<string, boolean>): ScoreOutcome {
    const lookup: RankedLookup = (attr) => (inputs[attr] ? (inputs[attr] as ReturnType<RankedLookup>) : undefined);
    return computeScore(model, lookup, (purpose) => consents[purpose] === true);
  }

  attributesFor(model: CompiledScoringModel) {
    return scoringAttributes(model);
  }

  private async improve(scoreResultId: string, subject: ScoringSubject, outcome: ScoreOutcome, facts: FactLookup) {
    const rules = await this.config.active<CompiledImprovementRule>(ConfigResource.improvement_rule);
    const lookup = scoreLookup(outcome, facts);
    const fired = buildImprovementPlan(rules.map((entry) => ({ key: entry.key, rule: entry.compiled, meta: entry.versionId })), subject.segmentKey, lookup);
    if (fired.length === 0) return;
    await this.repository.createImprovementItems(
      fired.map(({ key, rule, meta }) => ({
        scoreResultId,
        applicationId: subject.id,
        ruleKey: key,
        ruleVersionId: meta,
        priority: rule.priority,
        title: json(renderImprovementText(rule.texts.title, lookup)),
        found: json(renderImprovementText(rule.texts.found, lookup)),
        why: json(renderImprovementText(rule.texts.why, lookup)),
        action: json(renderImprovementText(rule.texts.action, lookup)),
        evidence: json(renderImprovementText(rule.texts.evidence, lookup)),
        evidenceDocumentType: rule.evidenceDocumentType,
      })),
    );
  }
}
