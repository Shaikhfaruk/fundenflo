import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { DAY_MS } from '../../../common/constants/time.constants.js';
import type { UserActor } from '../../../common/context/actor.js';
import { ApplicationEventType, DocumentRequestStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { OPEN_APPLICATION_STATES } from '../../../engines/state-machines/machines/application.machine.js';
import type { DocumentRequest } from '../../../generated/prisma/client.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { type ApplicationSubject, ApplicationService } from '../../applications/application/application.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { DocumentTypeService } from '../../documents/application/document-type.service.js';
import { DocumentService } from '../../documents/application/document.service.js';
import { DOCUMENT_REQUEST_FULFIL_BATCH, DOCUMENT_REQUESTS_LIMIT } from '../domain/submission.constants.js';
import { SubmissionRepository } from '../infrastructure/submission.repository.js';
import { toDocumentRequestView } from './submission.views.js';

export type DocumentRequestInput = { documentTypes: string[]; note?: string; dueInDays?: number };

export type DocumentScannedPayload = { partyId?: string; borrowerProfileId?: string | null; applicationId?: string | null };

@Injectable()
export class DocumentRequestService {
  constructor(
    private readonly repository: SubmissionRepository,
    private readonly applications: ApplicationService,
    private readonly types: DocumentTypeService,
    private readonly documents: DocumentService,
    private readonly changes: ChangeRecorder,
  ) {}

  async create(application: ApplicationSubject, submissionId: string | null, input: DocumentRequestInput, actor: UserActor) {
    const documentTypes = [...new Set(input.documentTypes)];
    const known = await this.types.activeByKeys(documentTypes);
    const unknown = documentTypes.filter((key) => !known.has(key));
    if (unknown.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: unknown.map((key) => ({ path: 'documentTypes', code: 'unknown_key', message: `unknown or inactive document type ${key}` })) });
    const request = await this.repository.createRequest({
      applicationId: application.id,
      submissionId,
      requestedByUserId: actor.userId,
      requestedContext: actor.context,
      documentTypes,
      note: input.note ?? null,
      dueAt: input.dueInDays ? new Date(Date.now() + input.dueInDays * DAY_MS) : null,
    });
    await this.applications.recordEvent(application.id, ApplicationEventType.document_requested, { note: input.note ?? null, data: { documentRequestId: request.id, submissionId, documentTypes } });
    await this.changes.record({
      action: AuditAction.DocumentRequested,
      entityType: AuditEntity.DocumentRequest,
      entityId: request.id,
      event: EventName.DocumentRequested,
      metadata: { applicationId: application.id, submissionId, documentTypes, context: actor.context },
      payload: { documentRequestId: request.id, applicationId: application.id, submissionId, documentTypes },
    });
    return request;
  }

  @Transactional()
  async forApplication(applicationId: string, input: DocumentRequestInput, actor: UserActor, ability: AppAbility, locale: Locale) {
    await this.applications.get(applicationId, ability);
    const application = await this.applications.subject(applicationId);
    if (!OPEN_APPLICATION_STATES.includes(application.status)) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: application.status, event: 'request_documents', allowed: [] } });
    const request = await this.create(application, null, input, actor);
    return (await this.views([request], locale))[0];
  }

  async list(applicationId: string, ability: AppAbility, locale: Locale) {
    await this.applications.get(applicationId, ability);
    const rows = await this.repository.requests({ AND: [accessibleBy(ability, AppAction.Read).ofType('DocumentRequest'), { applicationId }] }, DOCUMENT_REQUESTS_LIMIT);
    return { items: await this.views(rows, locale) };
  }

  async forSubmission(submissionId: string, locale: Locale) {
    return this.views(await this.repository.requests({ submissionId }, DOCUMENT_REQUESTS_LIMIT), locale);
  }

  async fulfil(payload: DocumentScannedPayload): Promise<string[]> {
    if (!payload.partyId || !payload.borrowerProfileId) return [];
    const open = await this.repository.requests({ status: DocumentRequestStatus.open, application: { borrowerProfileId: payload.borrowerProfileId }, ...(payload.applicationId ? { applicationId: payload.applicationId } : {}) }, DOCUMENT_REQUEST_FULFIL_BATCH);
    const submissionIds = new Set<string>();
    for (const request of open) {
      const fulfilled = await this.fulfilOne(request.id, payload.partyId);
      if (fulfilled?.submissionId) submissionIds.add(fulfilled.submissionId);
    }
    return [...submissionIds];
  }

  async cancelForSubmission(submissionId: string) {
    await this.repository.updateRequestsWhere({ submissionId, status: DocumentRequestStatus.open }, { status: DocumentRequestStatus.cancelled, cancelledAt: new Date() });
  }

  async cancelForApplication(applicationId: string) {
    await this.repository.updateRequestsWhere({ applicationId, submissionId: null, status: DocumentRequestStatus.open }, { status: DocumentRequestStatus.cancelled, cancelledAt: new Date() });
  }

  async openCount(submissionId: string) {
    return this.repository.countRequests({ submissionId, status: DocumentRequestStatus.open });
  }

  async sharedDocumentIds(submissionId: string) {
    return this.repository.fulfilledIds(submissionId);
  }

  @Transactional()
  private async fulfilOne(id: string, partyId: string) {
    await this.repository.lockRequest(id);
    const request = await this.repository.findRequest(id);
    if (request?.status !== DocumentRequestStatus.open) return null;
    const fresh = (await this.documents.analysable(partyId, request.applicationId)).filter((document) => request.documentTypes.includes(document.documentType.key) && document.createdAt >= request.createdAt);
    const held = new Set(fresh.map((document) => document.documentType.key));
    if (!request.documentTypes.every((key) => held.has(key))) return null;
    const documentIds = fresh.map((document) => document.id);
    const moved = await this.repository.updateRequestFromStatus(id, DocumentRequestStatus.open, { status: DocumentRequestStatus.fulfilled, fulfilledAt: new Date(), fulfilledDocumentIds: documentIds });
    if (moved.count === 0) return null;
    if (request.submissionId) await this.documents.lockShared(documentIds);
    await this.changes.record({
      action: AuditAction.DocumentRequestFulfilled,
      entityType: AuditEntity.DocumentRequest,
      entityId: id,
      event: EventName.DocumentRequestFulfilled,
      metadata: { applicationId: request.applicationId, submissionId: request.submissionId, documents: documentIds.length },
      payload: { documentRequestId: id, applicationId: request.applicationId, submissionId: request.submissionId },
    });
    return request;
  }

  private async views(rows: DocumentRequest[], locale: Locale) {
    const labels = await this.types.activeByKeys(rows.flatMap((row) => row.documentTypes));
    return rows.map((row) => toDocumentRequestView(row, labels, locale));
  }
}
