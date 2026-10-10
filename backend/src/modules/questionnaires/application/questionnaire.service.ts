import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { type AnswerChannel, CatalogStatus, ConfigResource, FactProvenance } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { uuidv7 } from '../../../common/ids/uuid-v7.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { FactValue } from '../../../engines/conditions/condition.types.js';
import { answerToFact } from '../../../engines/questionnaire/answer.js';
import { QuestionKind, type CompiledQuestionSet, type QuestionnaireContext, type ResolvedQuestion, type ResolvedQuestionnaire } from '../../../engines/questionnaire/questionnaire.types.js';
import { addProgressiveQuestions } from '../../../engines/questionnaire/progressive.js';
import { remainingRequired, resolveQuestionnaire } from '../../../engines/questionnaire/resolve.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { FactService } from '../../attributes/application/fact.service.js';
import { FactSourceType } from '../../attributes/domain/attribute.constants.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { GeoService } from '../../catalog/application/geo.service.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { PartyService } from '../../parties/application/party.service.js';
import type { ConfigIssue } from '../../config-publishing/domain/config.types.js';
import { MAX_ANSWERS_PER_WRITE } from '../domain/questionnaire.constants.js';
import { AnswerRepository } from '../infrastructure/answer.repository.js';
import { QuestionRepository } from '../infrastructure/question.repository.js';
import { AttributeNeedRegistry } from './attribute-need.registry.js';
import { QuestionSetHandler } from './question-set.handler.js';
import { compileQuestion, toAnswerView } from './questionnaire.views.js';

export type AnswerInput = { questionKey: string; value: unknown };

export type AnswerMeta = {
  channel: AnswerChannel;
  answeredByUserId?: string;
  leadId?: string;
  applicationId?: string;
};

type Overlay = Record<string, FactValue | undefined>;

@Injectable()
export class QuestionnaireService {
  constructor(
    private readonly config: ConfigPublishingService,
    private readonly handler: QuestionSetHandler,
    private readonly facts: FactService,
    private readonly answers: AnswerRepository,
    private readonly geo: GeoService,
    private readonly changes: ChangeRecorder,
    private readonly parties: PartyService,
    private readonly needs: AttributeNeedRegistry,
    private readonly questions: QuestionRepository,
  ) {}

  async resolve(context: QuestionnaireContext, partyId?: string, overlay?: Overlay): Promise<ResolvedQuestionnaire> {
    const published = await this.config.active<CompiledQuestionSet>(ConfigResource.question_set);
    const sets = published.map((entry) => ({ key: entry.key, versionId: entry.versionId, number: entry.number, set: entry.compiled }));
    const lookup = partyId || overlay ? await this.facts.lookup(partyId ?? null, overlay) : undefined;
    const resolved = resolveQuestionnaire(sets, context, lookup);
    if (!partyId || !lookup || this.needs.empty) return resolved;
    const needs = await this.needs.needs({ ...context, partyId });
    if (needs.length === 0) return resolved;
    const bank = new Map<string, ReturnType<typeof compileQuestion>>();
    for (const question of await this.questions.list({ attributeKey: { in: [...new Set(needs.map((need) => need.attributeKey))] }, status: CatalogStatus.active })) if (!bank.has(question.attributeKey)) bank.set(question.attributeKey, compileQuestion(question));
    const { questionnaire, added } = addProgressiveQuestions(resolved, needs, bank, (attribute) => lookup(attribute) !== undefined);
    return { ...questionnaire, progressive: added };
  }

  async preview(documentId: string, number: number, context: Omit<QuestionnaireContext, 'stage'>, partyId?: string, overlay?: Overlay) {
    const version = await this.config.getVersion(ConfigResource.question_set, documentId, number);
    const { compiled, issues } = version.compiled ? { compiled: version.compiled as CompiledQuestionSet, issues: [] } : await this.handler.compile(this.handler.contentSchema.parse(version.content));
    if (!compiled) return { valid: false, issues, questionnaire: null };
    const lookup = partyId || overlay ? await this.facts.lookup(partyId ?? null, overlay) : undefined;
    const questionnaire = resolveQuestionnaire([{ key: version.documentKey, versionId: version.id, number: version.number, set: compiled }], { ...context, stage: compiled.stage }, lookup);
    return { valid: true, issues: [], questionnaire };
  }

  @Transactional()
  async submitAnswers(partyId: string, context: QuestionnaireContext, inputs: AnswerInput[], meta: AnswerMeta) {
    if (inputs.length > MAX_ANSWERS_PER_WRITE) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'answers', code: 'too_big', message: `at most ${MAX_ANSWERS_PER_WRITE} answers per write` }] });
    }
    const questionnaire = await this.resolve(context);
    const byKey = new Map(questionnaire.questions.map((question) => [question.question.key, question]));
    const issues: ConfigIssue[] = [];
    const seen = new Set<string>();
    const prepared: Array<{ id: string; input: AnswerInput; question: ResolvedQuestion; fact: FactValue }> = [];
    for (const [index, input] of inputs.entries()) {
      const question = byKey.get(input.questionKey);
      if (seen.has(input.questionKey)) issues.push({ path: `answers.${index}.questionKey`, code: 'duplicate', message: `${input.questionKey} is answered twice` });
      seen.add(input.questionKey);
      if (!question) {
        issues.push({ path: `answers.${index}.questionKey`, code: 'unknown_question', message: `${input.questionKey} is not part of this questionnaire` });
        continue;
      }
      const result = answerToFact(question.question, input.value);
      if (!result.ok) {
        issues.push({ path: `answers.${index}.value`, code: 'invalid_answer', message: result.message });
        continue;
      }
      if (question.question.kind === QuestionKind.City && typeof result.value === 'string' && !(await this.geo.findActiveCity(result.value))) {
        issues.push({ path: `answers.${index}.value`, code: 'unknown_city', message: 'city not found' });
        continue;
      }
      prepared.push({ id: uuidv7(), input, question, fact: result.value });
    }
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });

    const recorded = await this.facts.record(
      partyId,
      prepared.map((answer) => ({ attributeKey: answer.question.question.attributeKey, value: answer.fact, sourceId: answer.id })),
      { provenance: FactProvenance.declared, sourceType: FactSourceType.QuestionAnswer, leadId: meta.leadId, applicationId: meta.applicationId, recordedByUserId: meta.answeredByUserId },
    );
    const factBySource = new Map(recorded.map((fact) => [fact.sourceId, fact.factId]));
    const saved = await this.answers.createMany(
      prepared.map((answer) => ({
        id: answer.id,
        partyId,
        questionSetVersionId: answer.question.setVersionId,
        questionKey: answer.input.questionKey,
        value: answer.input.value as Prisma.InputJsonValue,
        factId: factBySource.get(answer.id) ?? null,
        channel: meta.channel,
        answeredByUserId: meta.answeredByUserId ?? null,
        leadId: meta.leadId ?? null,
        applicationId: meta.applicationId ?? null,
      })),
    );
    const questionKeys = prepared.map((answer) => answer.input.questionKey);
    await this.changes.record({
      action: AuditAction.AnswersRecorded,
      entityType: AuditEntity.Party,
      entityId: partyId,
      event: EventName.AnswersRecorded,
      metadata: { stage: context.stage, channel: meta.channel, questionKeys, leadId: meta.leadId ?? null },
      payload: { partyId, stage: context.stage, questionKeys, leadId: meta.leadId ?? null, applicationId: meta.applicationId ?? null },
    });

    const lookup = await this.facts.lookup(partyId);
    const after = await this.resolve(context, partyId);
    const known = new Set(after.questions.filter((question) => lookup(question.question.attributeKey) !== undefined).map((question) => question.question.key));
    return { answers: saved.map(toAnswerView), facts: recorded, remaining: remainingRequired(after, known), hidden: after.hidden };
  }

  async listAnswers(partyId: string, query: PageQuery & { questionKey?: string }) {
    await this.parties.assertExists(partyId);
    const window = pageWindow(query);
    const rows = await this.answers.listForParty(partyId, query.questionKey, window.take, window.idFilter);
    return toPage(rows, query.limit, toAnswerView);
  }
}
