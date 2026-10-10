import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { actorTypeOf, type UserActor } from '../../../common/context/actor.js';
import { RequestContext } from '../../../common/context/request-context.service.js';
import { ApplicationEventType, ApplicationStatus, ConfigResource, ConsentChannel, MatchOutcome, SessionContext, SubmissionEventType, SubmissionStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { paiseFromNumber, paiseToNumber } from '../../../common/money/paise.js';
import { documentsNeeded } from '../../../engines/matching/match-products.js';
import { CLOSED_APPLICATION_STATES } from '../../../engines/state-machines/machines/application.machine.js';
import { LENDER_DECISION_EVENTS, OPEN_SUBMISSION_STATES, SubmissionEvent, submissionMachine } from '../../../engines/state-machines/machines/submission.machine.js';
import type { LenderSubmission, Prisma } from '../../../generated/prisma/client.js';
import { RefGenerator, RefKind } from '../../../infrastructure/database/ref-generator.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { type ApplicationSubject, ApplicationService } from '../../applications/application/application.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey, JOURNEY_CONSENT_CONTEXT } from '../../consents/domain/consent.constants.js';
import { DocumentService } from '../../documents/application/document.service.js';
import type { DocumentOwnerScope } from '../../documents/domain/document-owner.types.js';
import { LenderCatalogService } from '../../lenders/application/lender-catalog.service.js';
import { LenderService } from '../../lenders/application/lender.service.js';
import { MatchingService } from '../../matching/application/matching.service.js';
import { MATCH_DOCUMENT_STAGES } from '../../matching/domain/matching.constants.js';
import { RiskService } from '../../risk/application/risk.service.js';
import {
  EVIDENCE_REQUIRED_EVENTS,
  LENDER_SHARING_EVIDENCE,
  type RejectionReason,
  SUBMISSION_ACTION_EVENTS,
  SUBMISSION_EVENT_TYPES,
  SUBMISSION_EVENTS_LIMIT,
  SubmissionAction,
  SubmissionCloseReason,
  SUBMISSIONS_OPEN_MAX,
  SUBMISSIONS_PER_APPLICATION_LIMIT,
} from '../domain/submission.constants.js';
import { SubmissionRepository } from '../infrastructure/submission.repository.js';
import { type DocumentRequestInput, DocumentRequestService, type DocumentScannedPayload } from './document-request.service.js';
import { SubmissionPacketBuilder } from './submission-packet.builder.js';
import { SubmissionAudience, type SubmissionNames, toSubmissionView, visibleEvents } from './submission.views.js';

export type SubmissionActionInput = {
  action: SubmissionAction;
  note?: string;
  amountPaise?: number;
  lenderReference?: string;
  reason?: RejectionReason;
  evidenceDocumentId?: string;
  expectedVersion?: number;
};

export type SubmissionFilters = { status?: SubmissionStatus; lenderId?: string; applicationId?: string };

export const SubmissionChannel = {
  Lender: 'lender',
  Ops: 'ops',
} as const;

export type SubmissionChannel = (typeof SubmissionChannel)[keyof typeof SubmissionChannel];

type EventDetails = { fromStatus?: SubmissionStatus; toStatus?: SubmissionStatus; note?: string | null; data?: Record<string, unknown>; evidenceDocumentId?: string | null };

type Movement = { data?: Prisma.LenderSubmissionUncheckedUpdateManyInput; details?: EventDetails; action?: AuditAction; event?: EventName; payload?: Record<string, unknown> };

const CLOSED: readonly SubmissionStatus[] = [SubmissionStatus.rejected, SubmissionStatus.withdrawn];

const QUERYABLE: readonly SubmissionStatus[] = [SubmissionStatus.sent_to_lender, SubmissionStatus.under_review];

const REQUESTABLE: readonly SubmissionStatus[] = [SubmissionStatus.sent_to_lender, SubmissionStatus.under_review, SubmissionStatus.query_raised, SubmissionStatus.sanctioned];

const APPLICATION_ENDINGS: readonly string[] = [ApplicationStatus.withdrawn, ApplicationStatus.expired];

const audienceOf = (context: SessionContext): SubmissionAudience => {
  if (context === SessionContext.staff) return SubmissionAudience.Staff;
  if (context === SessionContext.lender) return SubmissionAudience.Lender;
  return SubmissionAudience.Borrower;
};

const required = (path: string, message: string) => new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path, code: 'required', message }] });

@Injectable()
export class SubmissionService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly applications: ApplicationService,
    private readonly matching: MatchingService,
    private readonly catalog: LenderCatalogService,
    private readonly lenders: LenderService,
    private readonly config: ConfigPublishingService,
    private readonly consents: ConsentService,
    private readonly documents: DocumentService,
    private readonly requests: DocumentRequestService,
    private readonly packets: SubmissionPacketBuilder,
    private readonly refs: RefGenerator,
    private readonly context: RequestContext,
    private readonly audit: AuditService,
    private readonly changes: ChangeRecorder,
    private readonly risk: RiskService,
  ) {}

  @Transactional()
  async request(applicationId: string, matchResultId: string, actor: UserActor, ability: AppAbility, locale: Locale, options: { shareWithLender?: boolean } = {}) {
    if (options.shareWithLender && actor.context !== SessionContext.borrower) throw new AppError(ErrorCode.FORBIDDEN);
    const application = await this.applications.prepareSubmission(applicationId, ability);
    const match = await this.matching.result(matchResultId);
    if (match.applicationId !== application.id || match.matchRunId !== application.latestMatchRunId) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'matchResultId', code: 'stale_match', message: 'choose a lender from your latest matches' }] });
    if (match.outcome !== MatchOutcome.eligible) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'matchResultId', code: 'not_eligible', message: 'this product is not a match yet' }] });
    const product = await this.liveProduct(match.productDocumentId);
    if (product.versionId !== match.productVersionId) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'matchResultId', code: 'stale_match', message: 'the lender changed this product; check your matches again' }] });
    const statuses = await this.submissions.statuses(application.id);
    if (await this.submissions.findOne({ applicationId: application.id, productDocumentId: product.documentId, status: { in: [...OPEN_SUBMISSION_STATES] } })) throw new AppError(ErrorCode.CONFLICT, { details: { productKey: product.key } });
    if (statuses.filter((status) => OPEN_SUBMISSION_STATES.includes(status)).length >= SUBMISSIONS_OPEN_MAX) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'matchResultId', code: 'too_many_submissions', message: `at most ${SUBMISSIONS_OPEN_MAX} lenders can review this application at once` }] });
    }
    const lender = (await this.lenders.summaries([match.lenderId])).get(match.lenderId);
    if (!lender) throw new AppError(ErrorCode.NOT_FOUND);
    if (options.shareWithLender) await this.shareWithLender(application.actingPartyId, lender.organizationId, application.id, actor, locale);
    const submission = await this.submissions.create({
      ref: await this.refs.next(RefKind.Submission),
      applicationId: application.id,
      lenderId: lender.id,
      lenderOrganizationId: lender.organizationId,
      productDocumentId: product.documentId,
      productVersionId: product.versionId,
      productKey: product.key,
      matchResultId: match.id,
      requestedByUserId: actor.userId,
    });
    await this.event(submission.id, SubmissionEventType.requested, { toStatus: submission.status, data: { matchResultId: match.id } });
    await this.applications.recordEvent(application.id, ApplicationEventType.submission_recorded, { data: { submissionId: submission.id, ref: submission.ref, lenderId: lender.id, to: submission.status } });
    await this.changes.record({
      action: AuditAction.SubmissionRequested,
      entityType: AuditEntity.LenderSubmission,
      entityId: submission.id,
      event: EventName.SubmissionRequested,
      metadata: { ref: submission.ref, applicationId: application.id, lenderId: lender.id, productKey: product.key },
      payload: this.payloadOf(submission, application, { to: submission.status }),
    });
    return this.view(submission, locale, audienceOf(actor.context));
  }

  async list(applicationId: string, ability: AppAbility, locale: Locale, context: SessionContext) {
    await this.applications.get(applicationId, ability);
    const rows = await this.submissions.list({ AND: [accessibleBy(ability, AppAction.Read).ofType('LenderSubmission'), { applicationId }] }, SUBMISSIONS_PER_APPLICATION_LIMIT);
    const names = await this.names(rows);
    return { items: rows.map((row) => toSubmissionView(row, names, locale, audienceOf(context))) };
  }

  async get(applicationId: string, id: string, ability: AppAbility, locale: Locale, context: SessionContext) {
    const submission = await this.visible(id, ability, AppAction.Read);
    if (submission.applicationId !== applicationId) throw new AppError(ErrorCode.NOT_FOUND);
    const audience = audienceOf(context);
    return { ...(await this.view(submission, locale, audience)), events: visibleEvents(await this.submissions.events(id, SUBMISSION_EVENTS_LIMIT), audience), documentRequests: await this.requests.forSubmission(id, locale) };
  }

  async byRef(ref: string, ability: AppAbility, locale: Locale, context: SessionContext) {
    const submission = await this.submissions.findOne({ AND: [accessibleBy(ability, AppAction.Read).ofType('LenderSubmission'), { ref: ref.toUpperCase() }] });
    if (!submission) throw new AppError(ErrorCode.NOT_FOUND);
    return this.get(submission.applicationId, submission.id, ability, locale, context);
  }

  async subject(id: string) {
    const submission = await this.require(id);
    const lender = (await this.lenders.summaries([submission.lenderId])).get(submission.lenderId);
    return { id: submission.id, ref: submission.ref, applicationId: submission.applicationId, status: submission.status, sentAt: submission.sentAt, lenderName: lender?.name ?? null };
  }

  async browse(ability: AppAbility, query: PageQuery & SubmissionFilters, locale: Locale, context: SessionContext) {
    const window = pageWindow(query);
    const filters: Prisma.LenderSubmissionWhereInput = { id: window.idFilter, status: query.status, lenderId: query.lenderId, applicationId: query.applicationId, ...(context === SessionContext.lender ? { sentAt: { not: null } } : {}) };
    const rows = await this.submissions.list({ AND: [accessibleBy(ability, AppAction.Read).ofType('LenderSubmission'), filters] }, window.take);
    const names = await this.names(rows);
    return toPage(rows, query.limit, (row) => toSubmissionView(row, names, locale, audienceOf(context)));
  }

  async detail(id: string, ability: AppAbility, locale: Locale, context: SessionContext) {
    const submission = await this.shared(id, ability, AppAction.Read, context);
    const audience = audienceOf(context);
    const packet = await this.submissions.latestPacket(id);
    return {
      ...(await this.view(submission, locale, audience)),
      packet: packet ? { id: packet.id, hash: packet.hash, createdAt: packet.createdAt.toISOString(), content: this.packets.read(packet) } : null,
      documents: await this.documents.summaries(await this.sharedDocumentIds(submission.id)),
      documentRequests: await this.requests.forSubmission(id, locale),
      events: visibleEvents(await this.submissions.events(id, SUBMISSION_EVENTS_LIMIT), audience),
    };
  }

  async documentUrl(id: string, documentId: string, ability: AppAbility, context: SessionContext) {
    const submission = await this.shared(id, ability, AppAction.Read, context);
    if (!(await this.sharedDocumentIds(submission.id)).includes(documentId)) throw new AppError(ErrorCode.NOT_FOUND);
    return this.documents.sharedReadUrl(documentId, { submissionId: submission.id, lenderOrganizationId: submission.lenderOrganizationId });
  }

  async documentScope(id: string, ability: AppAbility): Promise<DocumentOwnerScope> {
    const submission = await this.visible(id, ability, AppAction.Update);
    if (CLOSED.includes(submission.status)) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: submission.status, event: 'upload', allowed: [] } });
    const application = await this.applications.subject(submission.applicationId);
    return { partyId: application.partyId, borrowerProfileId: application.borrowerProfileId, applicationId: application.id, partnerOrganizationId: application.partnerOrganizationId };
  }

  @Transactional()
  async approve(id: string, note: string | undefined, expectedVersion: number | undefined, actor: UserActor, ability: AppAbility, locale: Locale) {
    await this.submissions.lock(id);
    const submission = await this.visible(id, ability, AppAction.Update);
    assertVersion(expectedVersion, submission.version);
    const application = await this.applications.subject(submission.applicationId);
    await this.risk.assertClear({ applicationId: application.id, partyIds: [application.partyId, application.actingPartyId] });
    await this.consents.assertConsent(application.actingPartyId, ConsentPurposeKey.LenderSharing, { organizationId: submission.lenderOrganizationId, explicitOnly: true });
    const product = await this.liveProduct(submission.productDocumentId);
    const missing = documentsNeeded(product.compiled.documents, MATCH_DOCUMENT_STAGES, await this.documents.heldTypes(application.partyId, application.id));
    if (missing.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: missing.map((key) => ({ path: 'documents', code: 'documents_missing', message: `${key} is needed before sending to the lender` })) });
    const clean = new Set((await this.documents.analysable(application.partyId, application.id)).map((document) => document.documentType.key));
    const pending = documentsNeeded(product.compiled.documents, MATCH_DOCUMENT_STAGES, clean);
    if (pending.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: pending.map((key) => ({ path: 'documents', code: 'documents_not_ready', message: `${key} is still being checked; approve once the check finishes` })) });
    await this.move(submission, application, SubmissionEvent.Approve, {
      data: { approvedByUserId: actor.userId, approvedAt: new Date() },
      details: { note: note ?? null },
      action: AuditAction.SubmissionApproved,
      event: EventName.SubmissionApproved,
    });
    return this.view(await this.require(id), locale, SubmissionAudience.Staff);
  }

  @Transactional()
  async deliver(id: string) {
    await this.submissions.lock(id);
    const submission = await this.submissions.findOne({ id });
    if (submission?.status !== SubmissionStatus.approved) return { delivered: false, packetId: null };
    const application = await this.applications.subject(submission.applicationId);
    if (!(await this.consents.hasConsent(application.actingPartyId, ConsentPurposeKey.LenderSharing, { organizationId: submission.lenderOrganizationId, explicitOnly: true }))) {
      await this.move(submission, application, SubmissionEvent.Withdraw, { data: { withdrawnReason: SubmissionCloseReason.ConsentWithdrawn }, details: { note: SubmissionCloseReason.ConsentWithdrawn } });
      return { delivered: false, packetId: null };
    }
    const packet = await this.packets.build(submission, application, await this.matching.result(submission.matchResultId));
    const stored = await this.submissions.createPacket({ submissionId: id, snapshot: packet.snapshot, documentIds: packet.documentIds, hash: packet.hash });
    await this.documents.lockShared(packet.documentIds);
    await this.audit.record({ action: AuditAction.SubmissionPacketBuilt, entityType: AuditEntity.LenderSubmission, entityId: id, metadata: { packetId: stored.id, hash: packet.hash, documents: packet.documentIds.length } });
    await this.move(submission, application, SubmissionEvent.Send, { data: { sentAt: new Date() }, details: { data: { packetId: stored.id, documents: packet.documentIds.length } } });
    await this.applications.markSubmitted(application.id);
    return { delivered: true, packetId: stored.id };
  }

  @Transactional()
  async act(id: string, input: SubmissionActionInput, channel: SubmissionChannel, ability: AppAbility, locale: Locale) {
    await this.submissions.lock(id);
    const submission = channel === SubmissionChannel.Lender ? await this.shared(id, ability, AppAction.Update, SessionContext.lender) : await this.visible(id, ability, AppAction.Update);
    assertVersion(input.expectedVersion, submission.version);
    const application = await this.applications.subject(submission.applicationId);
    const audience = channel === SubmissionChannel.Lender ? SubmissionAudience.Lender : SubmissionAudience.Staff;
    if (input.action === SubmissionAction.Note) {
      if (!input.note) throw required('note', 'write the note');
      await this.event(id, SubmissionEventType.note, { note: input.note });
      return this.view(submission, locale, audience);
    }
    const event = SUBMISSION_ACTION_EVENTS[input.action];
    if (channel === SubmissionChannel.Ops && LENDER_DECISION_EVENTS.includes(event) && !input.note) throw required('note', 'record how the lender shared this decision');
    if (channel === SubmissionChannel.Ops && EVIDENCE_REQUIRED_EVENTS.includes(event) && !input.evidenceDocumentId) throw required('evidenceDocumentId', 'attach the lender letter or advice');
    const evidenceDocumentId = input.evidenceDocumentId ? await this.documents.evidence(input.evidenceDocumentId, submission.applicationId) : null;
    await this.move(submission, application, event, { ...this.changeFor(submission, input, evidenceDocumentId), details: { note: input.note ?? null, evidenceDocumentId } });
    await this.settle(application.id);
    return this.view(await this.require(id), locale, audience);
  }

  @Transactional()
  async withdraw(applicationId: string, id: string, reason: string, ability: AppAbility, locale: Locale, context: SessionContext) {
    await this.submissions.lock(id);
    const submission = await this.visible(id, ability, AppAction.Update);
    if (submission.applicationId !== applicationId) throw new AppError(ErrorCode.NOT_FOUND);
    const application = await this.applications.subject(applicationId);
    await this.move(submission, application, SubmissionEvent.Withdraw, { data: { withdrawnReason: reason }, details: { note: reason } });
    await this.settle(applicationId);
    return this.view(await this.require(id), locale, audienceOf(context));
  }

  @Transactional()
  async requestDocuments(id: string, input: DocumentRequestInput, actor: UserActor, ability: AppAbility, locale: Locale) {
    await this.submissions.lock(id);
    const submission = await this.shared(id, ability, AppAction.Update, actor.context);
    if (!REQUESTABLE.includes(submission.status)) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: submission.status, event: 'request_documents', allowed: [] } });
    const application = await this.applications.subject(submission.applicationId);
    const request = await this.requests.create(application, submission.id, input, actor);
    if (QUERYABLE.includes(submission.status)) await this.move(submission, application, SubmissionEvent.RaiseQuery, { details: { note: input.note ?? null, data: { documentRequestId: request.id } } });
    else await this.event(id, SubmissionEventType.document_requested, { note: input.note ?? null, data: { documentRequestId: request.id } });
    return (await this.requests.forSubmission(id, locale)).find((view) => view.id === request.id);
  }

  async onDocumentScanned(payload: DocumentScannedPayload) {
    let answered = 0;
    for (const submissionId of await this.requests.fulfil(payload)) if (await this.answerWhenFulfilled(submissionId)) answered += 1;
    return answered;
  }

  async onApplicationClosed(applicationId: string, to: string) {
    if (!CLOSED_APPLICATION_STATES.includes(to as ApplicationStatus)) return 0;
    await this.requests.cancelForApplication(applicationId);
    if (!APPLICATION_ENDINGS.includes(to)) return 0;
    const open = await this.submissions.list({ applicationId, status: { in: [...OPEN_SUBMISSION_STATES] } }, SUBMISSIONS_PER_APPLICATION_LIMIT);
    for (const { id } of open) await this.withdrawForApplication(id, `application_${to}`);
    return open.length;
  }

  @Transactional()
  private async withdrawForApplication(id: string, reason: string) {
    await this.submissions.lock(id);
    const submission = await this.require(id);
    if (!OPEN_SUBMISSION_STATES.includes(submission.status)) return;
    await this.move(submission, await this.applications.subject(submission.applicationId), SubmissionEvent.Withdraw, { data: { withdrawnReason: reason }, details: { note: reason } });
  }

  @Transactional()
  private async answerWhenFulfilled(id: string) {
    await this.submissions.lock(id);
    const submission = await this.require(id);
    if (submission.status !== SubmissionStatus.query_raised || (await this.requests.openCount(id)) > 0) return false;
    await this.move(submission, await this.applications.subject(submission.applicationId), SubmissionEvent.AnswerQuery, { details: { note: SubmissionCloseReason.RequestsFulfilled } });
    return true;
  }

  private changeFor(submission: LenderSubmission, input: SubmissionActionInput, evidenceDocumentId: string | null): Omit<Movement, 'details'> {
    const lenderReference = input.lenderReference ?? submission.lenderReference;
    switch (input.action) {
      case SubmissionAction.Acknowledge:
        return { data: { lenderReference } };
      case SubmissionAction.RaiseQuery:
        if (!input.note) throw required('note', 'say what the lender needs');
        return {};
      case SubmissionAction.Sanction:
        if (!input.amountPaise) throw required('amountPaise', 'enter the sanctioned amount');
        return { data: { sanctionedAmountPaise: paiseFromNumber(input.amountPaise), sanctionedAt: new Date(), sanctionLetterDocumentId: evidenceDocumentId ?? submission.sanctionLetterDocumentId, lenderReference } };
      case SubmissionAction.Disburse:
        return this.disbursal(submission, input.amountPaise);
      case SubmissionAction.Reject:
        if (!input.reason) throw required('reason', 'choose why the lender declined');
        return { data: { rejectionReason: input.reason, rejectionNote: input.note ?? null } };
      case SubmissionAction.Withdraw:
        if (!input.note) throw required('note', 'say why the submission is withdrawn');
        return { data: { withdrawnReason: input.note } };
      default:
        return {};
    }
  }

  private disbursal(submission: LenderSubmission, amountPaise: number | undefined): Omit<Movement, 'details'> {
    if (!amountPaise) throw required('amountPaise', 'enter the disbursed amount');
    const total = submission.disbursedAmountPaise + paiseFromNumber(amountPaise);
    if (submission.sanctionedAmountPaise !== null && total > submission.sanctionedAmountPaise) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'amountPaise', code: 'exceeds_sanction', message: `total disbursal cannot exceed the sanctioned ${paiseToNumber(submission.sanctionedAmountPaise)} paise` }] });
    }
    return {
      data: { disbursedAmountPaise: total, disbursedAt: submission.disbursedAt ?? new Date() },
      event: EventName.SubmissionDisbursed,
      payload: { amountPaise, totalDisbursedPaise: paiseToNumber(total), sanctionedAmountPaise: submission.sanctionedAmountPaise === null ? null : paiseToNumber(submission.sanctionedAmountPaise) },
    };
  }

  private async move(submission: LenderSubmission, application: ApplicationSubject, event: SubmissionEvent, movement: Movement) {
    if (LENDER_DECISION_EVENTS.includes(event) && this.context.actor?.type !== 'user') throw new AppError(ErrorCode.FORBIDDEN, { details: { reason: 'decisions_need_a_person' } });
    const next = transitionOrThrow(submissionMachine, submission.status, event);
    const moved = await this.submissions.updateFromStatus(submission.id, submission.status, { ...movement.data, status: next, ...(CLOSED.includes(next) ? { closedAt: new Date() } : {}) });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.event(submission.id, SUBMISSION_EVENT_TYPES[event], { ...movement.details, fromStatus: submission.status, toStatus: next });
    await this.applications.recordEvent(submission.applicationId, ApplicationEventType.submission_recorded, { data: { submissionId: submission.id, ref: submission.ref, lenderId: submission.lenderId, from: submission.status, to: next } });
    if (CLOSED.includes(next)) await this.requests.cancelForSubmission(submission.id);
    await this.changes.record({
      action: movement.action ?? AuditAction.SubmissionStatusChanged,
      entityType: AuditEntity.LenderSubmission,
      entityId: submission.id,
      event: movement.event ?? EventName.SubmissionStatusChanged,
      metadata: { ref: submission.ref, from: submission.status, to: next, note: movement.details?.note ?? null },
      payload: this.payloadOf({ ...submission, status: next, sentAt: submission.sentAt ?? (next === SubmissionStatus.sent_to_lender ? new Date() : null) }, application, { from: submission.status, to: next, ...movement.payload }),
    });
    return next;
  }

  private async settle(applicationId: string) {
    const statuses = await this.submissions.statuses(applicationId);
    if (statuses.includes(SubmissionStatus.disbursed)) await this.applications.closeFromSubmissions(applicationId, true, SubmissionCloseReason.Disbursed);
    else if (statuses.length > 0 && statuses.every((status) => status === SubmissionStatus.rejected)) await this.applications.closeFromSubmissions(applicationId, false, SubmissionCloseReason.AllLendersDeclined);
  }

  private payloadOf(submission: LenderSubmission, application: ApplicationSubject, extra: Record<string, unknown>) {
    return {
      submissionId: submission.id,
      ref: submission.ref,
      applicationId: submission.applicationId,
      lenderId: submission.lenderId,
      lenderOrganizationId: submission.lenderOrganizationId,
      lenderVisible: submission.sentAt !== null,
      productKey: submission.productKey,
      requestedByUserId: submission.requestedByUserId,
      partyId: application.partyId,
      partnerOrganizationId: application.partnerOrganizationId,
      leadId: application.leadId,
      ...extra,
    };
  }

  private async shareWithLender(partyId: string, organizationId: string, applicationId: string, actor: UserActor, locale: Locale) {
    if (await this.consents.hasConsent(partyId, ConsentPurposeKey.LenderSharing, { organizationId, explicitOnly: true })) return;
    const template = await this.consents.template(JOURNEY_CONSENT_CONTEXT);
    await this.consents.record(
      partyId,
      [{ purpose: ConsentPurposeKey.LenderSharing, granted: true, organizationIds: [organizationId] }],
      { channel: ConsentChannel.app, templateVersionId: template.versionId, locale, capturedByUserId: actor.userId, applicationId, evidence: LENDER_SHARING_EVIDENCE },
      locale,
    );
  }

  private event(submissionId: string, type: SubmissionEventType, details: EventDetails) {
    const actor = this.context.actor;
    return this.submissions.createEvent({
      submissionId,
      type,
      fromStatus: details.fromStatus ?? null,
      toStatus: details.toStatus ?? null,
      actorType: actorTypeOf(actor),
      actorUserId: actor?.type === 'user' ? actor.userId : null,
      actorContext: actor?.type === 'user' ? actor.context : null,
      note: details.note ?? null,
      data: (details.data as Prisma.InputJsonValue | undefined) ?? undefined,
      evidenceDocumentId: details.evidenceDocumentId ?? null,
    });
  }

  private async sharedDocumentIds(submissionId: string) {
    const packet = await this.submissions.latestPacket(submissionId);
    return [...new Set([...(packet?.documentIds ?? []), ...(await this.submissions.evidenceIds(submissionId)), ...(await this.requests.sharedDocumentIds(submissionId))])];
  }

  private async liveProduct(documentId: string) {
    const product = (await this.catalog.liveProducts()).find((candidate) => candidate.documentId === documentId);
    if (!product) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'matchResultId', code: 'product_unavailable', message: 'this lender is not taking applications for the product right now' }] });
    return product;
  }

  private async view(submission: LenderSubmission, locale: Locale, audience: SubmissionAudience) {
    return toSubmissionView(submission, await this.names([submission]), locale, audience);
  }

  private async names(rows: LenderSubmission[]): Promise<SubmissionNames> {
    return {
      lenders: await this.lenders.summaries([...new Set(rows.map((row) => row.lenderId))]),
      products: await this.config.names(ConfigResource.lender_product, [...new Set(rows.map((row) => row.productDocumentId))]),
    };
  }

  private async shared(id: string, ability: AppAbility, action: AppAction, context: SessionContext) {
    const submission = await this.visible(id, ability, action);
    if (context === SessionContext.lender && submission.sentAt === null) throw new AppError(ErrorCode.NOT_FOUND);
    return submission;
  }

  visibleFor(id: string, ability: AppAbility, action: AppAction) {
    return this.visible(id, ability, action);
  }

  private async visible(id: string, ability: AppAbility, action: AppAction) {
    const submission = await this.submissions.findOne({ AND: [accessibleBy(ability, action).ofType('LenderSubmission'), { id }] });
    if (!submission) throw new AppError(ErrorCode.NOT_FOUND);
    return submission;
  }

  private async require(id: string) {
    const submission = await this.submissions.findOne({ id });
    if (!submission) throw new AppError(ErrorCode.NOT_FOUND);
    return submission;
  }
}
