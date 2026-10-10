import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { AnswerChannel, ApplicationChannel, ApplicationEventType, ApplicationStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { DEFAULT_LOCALE, type Locale } from '../../../common/i18n/locale.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { paiseFromNumber } from '../../../common/money/paise.js';
import { RefGenerator, RefKind } from '../../../infrastructure/database/ref-generator.js';
import { remainingRequired } from '../../../engines/questionnaire/resolve.js';
import type { QuestionnaireContext } from '../../../engines/questionnaire/questionnaire.types.js';
import { ApplicationEvent, applicationMachine, CLOSED_APPLICATION_STATES, PRE_SUBMISSION_APPLICATION_STATES } from '../../../engines/state-machines/machines/application.machine.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { BorrowerProfileService } from '../../borrowers/application/borrower-profile.service.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { PlaceLocator } from '../../catalog/application/place-locator.service.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { JOURNEY_CONSENT_CONTEXT } from '../../consents/domain/consent.constants.js';
import { DocumentChecklistService } from '../../documents/application/document-checklist.service.js';
import { DocumentStage } from '../../documents/domain/document.constants.js';
import type { DocumentOwnerScope } from '../../documents/domain/document-owner.types.js';
import { LeadService } from '../../leads/application/lead.service.js';
import { type AnswerInput, QuestionnaireService } from '../../questionnaires/application/questionnaire.service.js';
import { QuestionnaireStage } from '../../questionnaires/domain/questionnaire.constants.js';
import { APPLICATION_REFRESH_BATCH, APPLICATION_TIMELINE_LIMIT } from '../domain/application.constants.js';
import { computeJourney, JourneyStage } from '../domain/journey.js';
import { type ApplicationRow, ApplicationRepository } from '../infrastructure/application.repository.js';
import { ApplicationTimeline } from './application-timeline.service.js';
import { toApplicationEventView, toApplicationView } from './application.views.js';

export type CreateApplicationInput = { segment: string; subSegment?: string; businessName?: string; category?: string };

export type RequirementPatch = { category?: string; purpose?: string | null; purposeNote?: string | null; amountPaise?: number; tenureMonths?: number; cityId?: string; city?: string; pincode?: string };

export type ApplicationActor = { userId: string; actingPartyId: string; channel: ApplicationChannel; partnerOrganizationId: string | null; answerChannel: AnswerChannel };

@Injectable()
export class ApplicationService {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly timeline: ApplicationTimeline,
    private readonly borrowers: BorrowerProfileService,
    private readonly catalog: CatalogQueryService,
    private readonly places: PlaceLocator,
    private readonly questionnaires: QuestionnaireService,
    private readonly consents: ConsentService,
    private readonly checklists: DocumentChecklistService,
    private readonly leads: LeadService,
    private readonly refs: RefGenerator,
    private readonly changes: ChangeRecorder,
  ) {}

  @Transactional()
  async create(input: CreateApplicationInput, actor: ApplicationActor) {
    const profile = await this.borrowers.ensure(actor.actingPartyId, { segment: input.segment, subSegment: input.subSegment, businessName: input.businessName }, actor.userId, actor.partnerOrganizationId);
    const category = input.category ? await this.checkedCategory(input.category, input.segment) : null;
    const application = await this.applications.create({
      ref: await this.refs.next(RefKind.Application),
      borrowerProfileId: profile.id,
      partyId: profile.party.id,
      actingPartyId: actor.actingPartyId,
      channel: actor.channel,
      partnerOrganizationId: actor.partnerOrganizationId,
      segmentKey: input.segment,
      subSegmentKey: input.subSegment ?? profile.subSegmentKey,
      categoryKey: category?.key ?? null,
      journeyStage: category ? JourneyStage.Requirement : JourneyStage.Category,
      createdByUserId: actor.userId,
    });
    await this.timeline.record(application.id, ApplicationEventType.created, { toStatus: ApplicationStatus.draft, data: { channel: actor.channel, segment: input.segment, category: category?.key ?? null } });
    const leadId = await this.leads.convertToApplication([...new Set([actor.actingPartyId, profile.party.id])], application.id);
    if (leadId) {
      await this.applications.update(application.id, { leadId });
      await this.timeline.record(application.id, ApplicationEventType.lead_linked, { data: { leadId } });
    }
    await this.changes.record({ action: AuditAction.ApplicationCreated, entityType: AuditEntity.LoanApplication, entityId: application.id, event: EventName.ApplicationCreated, metadata: { ref: application.ref, channel: actor.channel, leadId }, payload: { applicationId: application.id, partyId: application.partyId, leadId, partnerOrganizationId: actor.partnerOrganizationId } });
    return toApplicationView(await this.require(application.id));
  }

  async list(ability: AppAbility, query: PageQuery & { status?: ApplicationStatus }) {
    const window = pageWindow(query);
    const rows = await this.applications.list({ AND: [accessibleBy(ability, AppAction.Read).ofType('LoanApplication'), { id: window.idFilter, status: query.status }] }, window.take);
    return toPage(rows, query.limit, toApplicationView);
  }

  async get(id: string, ability: AppAbility) {
    return toApplicationView(await this.visible(id, ability, AppAction.Read));
  }

  @Transactional()
  async updateRequirement(id: string, patch: RequirementPatch, expectedVersion: number | undefined, ability: AppAbility) {
    const application = await this.visible(id, ability, AppAction.Update);
    assertVersion(expectedVersion, application.version);
    this.assertOpen(application);
    const categoryKey = patch.category ?? application.categoryKey;
    const category = categoryKey ? await this.checkedCategory(categoryKey, application.segmentKey) : null;
    const issues: Array<{ path: string; code: string; message: string }> = [];
    const purpose = patch.purpose === undefined ? application.purposeKey : patch.purpose;
    const purposeConfig = purpose ? category?.purposes.find((candidate) => candidate.key === purpose) : undefined;
    if (purpose && !purposeConfig) issues.push({ path: 'purpose', code: 'unknown_key', message: `${purpose} is not a purpose of ${category?.key ?? 'this category'}` });
    const purposeNote = patch.purposeNote === undefined ? application.purposeNote : patch.purposeNote;
    if (purposeConfig?.requiresNote && !purposeNote) issues.push({ path: 'purposeNote', code: 'required', message: 'describe the purpose' });
    if (patch.amountPaise !== undefined && category && (patch.amountPaise < category.minAmountPaise || patch.amountPaise > category.maxAmountPaise)) {
      issues.push({ path: 'amountPaise', code: 'out_of_range', message: `must be between ${category.minAmountPaise} and ${category.maxAmountPaise} paise` });
    }
    if (patch.tenureMonths !== undefined && category && category.tenureOptionsMonths.length > 0 && !category.tenureOptionsMonths.includes(patch.tenureMonths)) {
      issues.push({ path: 'tenureMonths', code: 'not_offered', message: `choose one of ${category.tenureOptionsMonths.join(', ')} months` });
    }
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
    const location = patch.cityId || patch.city || patch.pincode ? await this.places.locate({ cityId: patch.cityId, city: patch.city, pincode: patch.pincode }) : null;
    if (location?.unmapped) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'city', code: 'unknown_city', message: `we could not find ${patch.city ?? 'this city'}` }] });
    const data: Prisma.LoanApplicationUncheckedUpdateManyInput = {
      categoryKey: category?.key ?? null,
      purposeKey: purpose ?? null,
      purposeNote: purposeNote ?? null,
      ...(patch.amountPaise === undefined ? {} : { amountPaise: paiseFromNumber(patch.amountPaise) }),
      ...(patch.tenureMonths === undefined ? {} : { tenureMonths: patch.tenureMonths }),
      ...(location ? { stateId: location.stateId, cityId: location.cityId, pincode: location.pincode } : {}),
    };
    const moved = await this.applications.updateVersioned(id, application.version, data);
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: application.version + 1 } });
    await this.timeline.record(id, ApplicationEventType.requirement_changed, { data: { fields: Object.keys(patch) } });
    await this.refreshStage(id);
    await this.changes.record({ action: AuditAction.ApplicationChanged, entityType: AuditEntity.LoanApplication, entityId: id, event: EventName.ApplicationUpdated, metadata: { ref: application.ref, fields: Object.keys(patch) }, payload: { applicationId: id } });
    return toApplicationView(await this.require(id));
  }

  async questions(id: string, stage: string, ability: AppAbility) {
    const application = await this.visible(id, ability, AppAction.Read);
    return this.questionnaires.resolve(this.contextOf(application, stage), application.partyId);
  }

  @Transactional()
  async submitAnswers(id: string, stage: string, inputs: AnswerInput[], actor: ApplicationActor, ability: AppAbility) {
    await this.applications.lock(id);
    const application = await this.visible(id, ability, AppAction.Update);
    this.assertOpen(application);
    const result = await this.questionnaires.submitAnswers(application.partyId, this.contextOf(application, stage), inputs, { channel: actor.answerChannel, answeredByUserId: actor.userId, applicationId: id, leadId: application.leadId ?? undefined });
    await this.timeline.record(id, ApplicationEventType.answers_recorded, { data: { stage, questions: inputs.map((input) => input.questionKey) } });
    if (stage === QuestionnaireStage.PreCheck) {
      const resolved = await this.questionnaires.resolve(this.contextOf(application, stage), application.partyId);
      const pinned = { ...(application.pinnedVersions as Record<string, unknown>), preCheck: resolved.sets.map((set) => set.versionId) };
      await this.applications.update(id, { pinnedVersions: pinned });
      const answered = new Set((await this.questionnaires.listAnswers(application.partyId, { limit: 100 })).items.map((answer) => answer.questionKey));
      if (application.status === ApplicationStatus.draft && remainingRequired(resolved, answered).length === 0) await this.transition(application, ApplicationEvent.PreScreen);
    }
    await this.refreshStage(id);
    return result;
  }

  async nextStep(id: string, ability: AppAbility, locale: Locale = DEFAULT_LOCALE) {
    return this.journeyOf(await this.visible(id, ability, AppAction.Read), locale);
  }

  async timelineOf(id: string, ability: AppAbility) {
    await this.visible(id, ability, AppAction.Read);
    return { items: (await this.applications.events(id, APPLICATION_TIMELINE_LIMIT)).map(toApplicationEventView) };
  }

  async checklist(id: string, ability: AppAbility, locale: Locale, stage: string = DocumentStage.Assessment) {
    const application = await this.visible(id, ability, AppAction.Read);
    return this.checklists.heldChecklist({ stage, segment: application.segmentKey, subSegment: application.subSegmentKey ?? undefined, category: application.categoryKey ?? undefined }, locale, { partyId: application.partyId, applicationId: application.id });
  }

  async documentScope(id: string, ability: AppAbility): Promise<DocumentOwnerScope> {
    const application = await this.visible(id, ability, AppAction.Update);
    this.assertOpen(application);
    return { partyId: application.partyId, borrowerProfileId: application.borrowerProfileId, applicationId: application.id, partnerOrganizationId: application.partnerOrganizationId };
  }

  async refreshForParties(partyIds: string[]) {
    const open = await this.applications.openForParties(partyIds, [...PRE_SUBMISSION_APPLICATION_STATES], APPLICATION_REFRESH_BATCH);
    for (const { id } of open) await this.refreshLocked(id);
    return open.length;
  }

  @Transactional()
  async withdraw(id: string, reason: string, ability: AppAbility) {
    await this.applications.lock(id);
    const application = await this.visible(id, ability, AppAction.Update);
    await this.transition(application, ApplicationEvent.Withdraw, reason);
    return toApplicationView(await this.require(id));
  }

  async transition(application: ApplicationRow, event: ApplicationEvent, reason: string | null = null) {
    const next = transitionOrThrow(applicationMachine, application.status, event);
    const closing = CLOSED_APPLICATION_STATES.includes(next);
    const moved = await this.applications.updateFromStatus(application.id, application.status, { status: next, ...(closing ? { closedAt: new Date(), closeReason: reason } : {}) });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.timeline.record(application.id, ApplicationEventType.status_changed, { fromStatus: application.status, toStatus: next, reason });
    await this.changes.record({
      action: AuditAction.ApplicationStatusChanged,
      entityType: AuditEntity.LoanApplication,
      entityId: application.id,
      event: EventName.ApplicationStatusChanged,
      metadata: { ref: application.ref, from: application.status, to: next, reason },
      payload: { applicationId: application.id, partyId: application.partyId, partnerOrganizationId: application.partnerOrganizationId, leadId: application.leadId, from: application.status, to: next },
    });
    return next;
  }

  @Transactional()
  private async refreshLocked(id: string) {
    await this.applications.lock(id);
    await this.refreshStage(id);
  }

  private async refreshStage(id: string) {
    const application = await this.require(id);
    const journey = await this.journeyOf(application, DEFAULT_LOCALE);
    if (application.status === ApplicationStatus.pre_screened && journey.completed.includes(JourneyStage.Consent)) await this.transition(application, ApplicationEvent.RequestDocuments);
    if (journey.stage === application.journeyStage) return;
    await this.applications.update(id, { journeyStage: journey.stage });
    await this.timeline.record(id, ApplicationEventType.stage_changed, { data: { from: application.journeyStage, to: journey.stage } });
  }

  private async journeyOf(application: ApplicationRow, locale: Locale) {
    const requirementMissing = [
      ...(application.amountPaise === null ? ['amountPaise'] : []),
      ...(application.tenureMonths === null ? ['tenureMonths'] : []),
      ...(application.cityId === null && application.pincode === null ? ['location'] : []),
      ...(application.purposeKey === null ? ['purpose'] : []),
    ];
    const context = this.contextOf(application, QuestionnaireStage.PreCheck);
    const questionnaire = await this.questionnaires.resolve(context, application.partyId);
    const answers = await this.questionnaires.listAnswers(application.partyId, { limit: 100 });
    const consentMissing = await this.consents.missingRequired(application.actingPartyId, JOURNEY_CONSENT_CONTEXT);
    const checklist = await this.checklists.heldChecklist({ stage: DocumentStage.Assessment, segment: application.segmentKey, subSegment: application.subSegmentKey ?? undefined, category: application.categoryKey ?? undefined }, locale, { partyId: application.partyId, applicationId: application.id });
    const answered = new Set(answers.items.map((answer) => answer.questionKey));
    return computeJourney({
      categoryChosen: application.categoryKey !== null,
      requirementMissing,
      preCheckRemaining: remainingRequired(questionnaire, answered),
      consentMissing,
      documentsMissing: checklist.items.filter((item) => item.required && !item.conditional && !item.satisfied).map((item) => item.key),
      detailsVerified: false,
      scored: false,
      matched: false,
      applied: false,
    });
  }

  private contextOf(application: ApplicationRow, stage: string): QuestionnaireContext {
    return { stage, segment: application.segmentKey, subSegment: application.subSegmentKey ?? undefined, category: application.categoryKey ?? undefined };
  }

  private async checkedCategory(key: string, segment: string) {
    const category = await this.catalog.categoryConfig(key, DEFAULT_LOCALE);
    if (!category || !category.segments.includes(segment)) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'category', code: 'unknown_key', message: `${key} is not offered to ${segment} borrowers` }] });
    return category;
  }

  private assertOpen(application: ApplicationRow) {
    if (CLOSED_APPLICATION_STATES.includes(application.status)) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: application.status, event: 'edit', allowed: [] } });
  }

  private async visible(id: string, ability: AppAbility, action: AppAction) {
    const application = await this.applications.findOne({ AND: [accessibleBy(ability, action).ofType('LoanApplication'), { id }] });
    if (!application) throw new AppError(ErrorCode.NOT_FOUND);
    return application;
  }

  private async require(id: string) {
    const application = await this.applications.findOne({ id });
    if (!application) throw new AppError(ErrorCode.NOT_FOUND);
    return application;
  }
}
