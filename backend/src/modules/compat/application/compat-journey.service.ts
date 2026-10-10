import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { MONTHS_PER_YEAR } from '../../../common/constants/time.constants.js';
import { AnswerChannel, ApplicationChannel, ConsentChannel, MatchOutcome, NotificationChannel } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { type Locale, localise } from '../../../common/i18n/locale.js';
import { PAISE_PER_RUPEE, paiseToNumber, rupeesToPaise } from '../../../common/money/paise.js';
import { PRE_SUBMISSION_APPLICATION_STATES } from '../../../engines/state-machines/machines/application.machine.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { type ApplicationActor, ApplicationService } from '../../applications/application/application.service.js';
import { AnalysisService } from '../../assessments/application/analysis.service.js';
import { MeService } from '../../auth/application/me.service.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey, JOURNEY_CONSENT_CONTEXT } from '../../consents/domain/consent.constants.js';
import { DocumentService } from '../../documents/application/document.service.js';
import type { StagedUpload } from '../../documents/infrastructure/document-upload.engine.js';
import { LenderCatalogService } from '../../lenders/application/lender-catalog.service.js';
import { LenderService } from '../../lenders/application/lender.service.js';
import { MatchingService } from '../../matching/application/matching.service.js';
import { QuestionnaireStage } from '../../questionnaires/domain/questionnaire.constants.js';
import { SubmissionService } from '../../submissions/application/submission.service.js';
import { SubscriptionService } from '../../subscriptions/application/subscription.service.js';
import { SubscriptionEvent } from '../../subscriptions/domain/subscription.constants.js';
import {
  COMPAT_CONSENT_PURPOSES,
  COMPAT_DEFAULT_INTEREST,
  COMPAT_DEFAULT_SUB_SEGMENTS,
  COMPAT_DOCUMENT_TYPES,
  COMPAT_LENDER_KIND_LABELS,
  COMPAT_QUESTION_KEYS,
  COMPAT_UNAVAILABLE_REASON,
  CompatApplicationEvent,
} from '../domain/compat.constants.js';
import type { CompatAnalysisDto, CompatConsentDto, CompatPreCheckDto, CompatRequirementDto, CompatSubscriptionDto } from '../http/compat.dto.js';
import { basedOnText, toCompatAnalysis, toCompatApplication, toCompatAssessment, toCompatDocumentStatus } from './compat.views.js';

const cityOf = (location: string) => location.split(',')[0]?.trim() ?? location;

const rupeesOf = (amountPaise: number | null) => (amountPaise === null ? null : amountPaise / Number(PAISE_PER_RUPEE));

const LENDER_CONSENT_EVIDENCE = 'Chose this lender and confirmed sharing in the app';

@Injectable()
export class CompatJourneyService {
  constructor(
    private readonly applications: ApplicationService,
    private readonly me: MeService,
    private readonly catalog: CatalogQueryService,
    private readonly consents: ConsentService,
    private readonly documents: DocumentService,
    private readonly analyses: AnalysisService,
    private readonly matching: MatchingService,
    private readonly lenderDirectory: LenderService,
    private readonly lenderCatalog: LenderCatalogService,
    private readonly submissions: SubmissionService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async categories(entityType: string, locale: Locale) {
    const categories = await this.catalog.categories(locale, { segmentKey: entityType });
    return { categories: categories.map((category) => ({ id: category.key, available: category.availability.available, ...(category.availability.available ? {} : { reason: COMPAT_UNAVAILABLE_REASON }) })) };
  }

  @Transactional()
  async requirement(input: CompatRequirementDto, actor: UserActor, ability: AppAbility) {
    const current = await this.applications.current(ability);
    const reusable = current && PRE_SUBMISSION_APPLICATION_STATES.includes(current.status) && current.segmentKey === input.entityType ? current : null;
    const application = reusable ?? (await this.applications.create({ segment: input.entityType, subSegment: COMPAT_DEFAULT_SUB_SEGMENTS[input.entityType], category: input.loanCategory }, await this.actorOf(actor)));
    await this.applications.updateRequirement(
      application.id,
      { category: input.loanCategory, purpose: input.purpose, purposeNote: input.purposeNote ?? null, amountPaise: paiseToNumber(rupeesToPaise(input.amount)), tenureMonths: input.tenureYears * MONTHS_PER_YEAR, city: cityOf(input.location) },
      undefined,
      ability,
    );
    return { id: application.id };
  }

  async preCheck(input: CompatPreCheckDto, actor: UserActor, ability: AppAbility) {
    const application = await this.requireCurrent(ability);
    const answers = Object.entries(input.answers).map(([id, value]) => ({ questionKey: COMPAT_QUESTION_KEYS[id] ?? id, value }));
    await this.applications.submitAnswers(application.id, QuestionnaireStage.PreCheck, answers, await this.actorOf(actor), ability);
    return { ok: true };
  }

  async consent(input: CompatConsentDto, actor: UserActor, ability: AppAbility, locale: Locale) {
    const application = await this.requireCurrent(ability);
    const template = await this.consents.template(JOURNEY_CONSENT_CONTEXT);
    const items = Object.entries(input.items).flatMap(([id, item]) => {
      const purpose = COMPAT_CONSENT_PURPOSES[id];
      return purpose ? [{ purpose, granted: item.granted }] : [];
    });
    if (PRE_SUBMISSION_APPLICATION_STATES.includes(application.status)) await this.applications.recordConsent(application.id, { templateVersionId: template.versionId, items }, actor.userId, ability, locale);
    else await this.consents.record(application.actingParty.id, items, { channel: ConsentChannel.app, templateVersionId: template.versionId, locale, capturedByUserId: actor.userId, applicationId: application.id }, locale);
    return { ok: true };
  }

  async upload(file: StagedUpload | undefined, fields: unknown, actor: UserActor, ability: AppAbility) {
    const docType = (fields as { docType?: unknown } | null)?.docType;
    const application = await this.applications.current(ability);
    const mapped = typeof docType === 'string' ? (COMPAT_DOCUMENT_TYPES[docType] ?? docType) : '';
    const document = await this.documents.upload(file, { documentType: mapped, ...(application ? { applicationId: application.id } : {}) }, actor, ability);
    return { id: document.id, ...toCompatDocumentStatus(document) };
  }

  async documentStatus(id: string, ability: AppAbility) {
    return toCompatDocumentStatus(await this.documents.get(id, ability));
  }

  async startAnalysis(input: CompatAnalysisDto, actor: UserActor, ability: AppAbility, locale: Locale) {
    const application = await this.requireCurrent(ability);
    const analysis = await this.analyses.request(application.id, { documentIds: input.documentIds.length > 0 ? input.documentIds : undefined }, actor.userId, ability, locale);
    return { id: analysis.id };
  }

  async analysis(id: string, ability: AppAbility, locale: Locale) {
    return toCompatAnalysis(await this.analyses.get(id, ability, locale));
  }

  async score(analysisId: string, ability: AppAbility, locale: Locale) {
    const analysis = await this.analyses.get(analysisId, ability, locale);
    const assessment = await this.analyses.assessment(analysis.applicationId, ability, locale);
    const titles = [...new Set((await this.documents.summaries(analysis.documentIds)).map((document) => localise(document.documentType.label, locale)).filter(Boolean))];
    return toCompatAssessment(assessment.score, assessment.improvement, basedOnText(titles));
  }

  async lenders(analysisId: string, actor: UserActor, ability: AppAbility, locale: Locale) {
    const analysis = await this.analyses.get(analysisId, ability, locale);
    const application = await this.applications.get(analysis.applicationId, ability);
    const run = PRE_SUBMISSION_APPLICATION_STATES.includes(application.status) ? await this.matching.request(application.id, actor.userId, ability, locale) : await this.matching.latest(application.id, ability, locale, false);
    const lenders = await this.lenderDirectory.summaries([...new Set(run.items.map((item) => item.lender.id))]);
    const products = new Map((await this.lenderCatalog.liveProducts()).map((product) => [product.documentId, product.compiled]));
    return {
      lenders: run.items.map((item) => {
        const lender = lenders.get(item.lender.id);
        const pricing = products.get(item.product.id)?.pricingDisclosure;
        return {
          id: item.id,
          name: item.lender.name ?? '',
          kind: lender ? COMPAT_LENDER_KIND_LABELS[lender.kind] : '',
          product: item.product.name,
          verified: item.outcome === MatchOutcome.eligible,
          interest: (pricing ? localise(pricing, locale) : '') || COMPAT_DEFAULT_INTEREST,
          ...(item.documentsNeeded.length > 0 ? { documentsStillNeeded: item.documentsNeeded.length } : {}),
          reasons: item.reasons,
        };
      }),
    };
  }

  @Transactional()
  async apply(matchResultId: string, actor: UserActor, ability: AppAbility, locale: Locale) {
    const match = await this.matching.result(matchResultId);
    const application = await this.applications.get(match.applicationId, ability);
    const lender = (await this.lenderDirectory.summaries([match.lenderId])).get(match.lenderId);
    if (!lender) throw new AppError(ErrorCode.NOT_FOUND);
    const partyId = application.actingParty.id;
    if (!(await this.consents.hasConsent(partyId, ConsentPurposeKey.LenderSharing))) throw new AppError(ErrorCode.CONSENT_REQUIRED, { details: { purpose: ConsentPurposeKey.LenderSharing, organizationId: lender.organizationId } });
    if (!(await this.consents.hasConsent(partyId, ConsentPurposeKey.LenderSharing, { organizationId: lender.organizationId, explicitOnly: true }))) {
      const template = await this.consents.template(JOURNEY_CONSENT_CONTEXT);
      await this.consents.record(
        partyId,
        [{ purpose: ConsentPurposeKey.LenderSharing, granted: true, organizationIds: [lender.organizationId] }],
        { channel: ConsentChannel.app, templateVersionId: template.versionId, locale, capturedByUserId: actor.userId, applicationId: application.id, evidence: LENDER_CONSENT_EVIDENCE },
        locale,
      );
    }
    const submission = await this.submissions.request(application.id, matchResultId, actor, ability, locale);
    return toCompatApplication(await this.submissions.get(application.id, submission.id, ability, locale, actor.context), rupeesOf(application.amountPaise), locale);
  }

  async application(ref: string, actor: UserActor, ability: AppAbility, locale: Locale) {
    const submission = await this.submissions.byRef(ref, ability, locale, actor.context);
    const application = await this.applications.get(submission.applicationId, ability);
    return toCompatApplication(submission, rupeesOf(application.amountPaise), locale);
  }

  async subscribe(input: CompatSubscriptionDto, actor: UserActor, ability: AppAbility, locale: Locale) {
    if (input.event === CompatApplicationEvent.AnalysisCompleted && input.analysisId) {
      await this.subscriptions.subscribe(actor.userId, { event: SubscriptionEvent.AnalysisCompleted, entityId: input.analysisId, channel: NotificationChannel.push }, ability);
      return { ok: true };
    }
    if (input.event === CompatApplicationEvent.ApplicationStatus && input.applicationId) {
      const submission = await this.submissions.byRef(input.applicationId, ability, locale, actor.context);
      await this.subscriptions.subscribe(actor.userId, { event: SubscriptionEvent.SubmissionStatusChanged, entityId: submission.id, channel: NotificationChannel.push }, ability);
      return { ok: true };
    }
    throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'event', code: 'missing_reference', message: 'send analysisId for analysis.completed or applicationId for application.status' }] });
  }

  private async requireCurrent(ability: AppAbility) {
    const application = await this.applications.current(ability);
    if (!application) throw new AppError(ErrorCode.NOT_FOUND, { details: { reason: 'no_application' } });
    return application;
  }

  private async actorOf(actor: UserActor): Promise<ApplicationActor> {
    return { userId: actor.userId, actingPartyId: await this.me.partyIdOf(actor.userId), channel: ApplicationChannel.direct, partnerOrganizationId: null, answerChannel: AnswerChannel.borrower };
  }
}
