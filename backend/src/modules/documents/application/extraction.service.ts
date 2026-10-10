import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { DocumentRejectReason, DocumentStatus, ExtractionStatus, FactProvenance } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { DocumentEvent, documentMachine } from '../../../engines/state-machines/machines/document.machine.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { InjectObjectStorage, type ObjectStorage } from '../../../infrastructure/storage/storage.port.js';
import { type DocumentExtractor, type ExtractedField, type ExtractionOutcome, InjectDocumentExtractor } from '../../../integrations/extraction/document-extractor.port.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { FactService } from '../../attributes/application/fact.service.js';
import { FactSourceType } from '../../attributes/domain/attribute.constants.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { BorrowerProfileService } from '../../borrowers/application/borrower-profile.service.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';
import { EXTRACTION_CLASS_MIN_CONFIDENCE, EXTRACTION_MIN_CONFIDENCE, EXTRACTION_PENDING_BATCH, OPS_EXTRACTOR } from '../domain/document.constants.js';
import { type DocumentRow, DocumentRepository } from '../infrastructure/document.repository.js';
import { documentEventPayload, DocumentService } from './document.service.js';
import { toDocumentView } from './document.views.js';
import { DocumentTypeService } from './document-type.service.js';

export type ExtractOutcome = 'verified' | 'needs_review' | 'skipped' | 'no_consent';

export type ReviewInput = { outcome: 'verified' | 'rejected'; fields: Array<{ attributeKey: string; value: unknown }>; rejectReason?: DocumentRejectReason; note?: string };

const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class ExtractionService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly service: DocumentService,
    private readonly types: DocumentTypeService,
    private readonly profiles: BorrowerProfileService,
    private readonly consents: ConsentService,
    private readonly facts: FactService,
    private readonly cipher: FieldCipher,
    private readonly changes: ChangeRecorder,
    @InjectDocumentExtractor() private readonly extractor: DocumentExtractor,
    @InjectObjectStorage() private readonly storage: ObjectStorage,
  ) {}

  async extract(documentId: string): Promise<ExtractOutcome> {
    const document = await this.documents.findOne({ id: documentId });
    if (document?.status !== DocumentStatus.scanned || !document.borrowerProfileId) return 'skipped';
    const actingPartyId = await this.profiles.actingPartyOf(document.borrowerProfileId);
    if (!actingPartyId || !(await this.consents.hasConsent(actingPartyId, ConsentPurposeKey.AiDocuments))) return 'no_consent';
    const claimed = await this.claim(documentId);
    if (!claimed) return 'skipped';
    const type = (await this.types.activeByKeys([claimed.documentType.key])).get(claimed.documentType.key);
    const outcome = await this.extractor.extract({
      documentType: claimed.documentType.key,
      extractorKey: claimed.documentType.extractorKey,
      producesAttributes: type?.producesAttributes ?? [],
      mimeType: claimed.mimeType,
      body: await this.storage.read(claimed.storageKey),
      password: claimed.passwordEnc ? this.cipher.decrypt(claimed.passwordEnc, CipherPurpose.DocumentPassword) : null,
    });
    return this.finish(claimed, outcome, new Set(type?.producesAttributes ?? []));
  }

  async extractPending(partyId: string): Promise<number> {
    const profileIds = await this.profiles.profileIdsActedBy(partyId);
    if (profileIds.length === 0) return 0;
    let done = 0;
    for (const id of await this.documents.scannedForProfiles(profileIds, EXTRACTION_PENDING_BATCH)) if ((await this.extract(id)) !== 'skipped') done += 1;
    return done;
  }

  async extractions(documentId: string, ability: AppAbility) {
    await this.service.get(documentId, ability);
    return { items: (await this.documents.extractions(documentId)).map((row) => ({ id: row.id, extractor: row.extractor, model: row.model, promptVersion: row.promptVersion, status: row.status, classifiedAs: row.classifiedAs, classConfidence: row.classConfidence === null ? null : Number(row.classConfidence), fields: row.fields, reason: row.reason, reviewedByUserId: row.reviewedByUserId, createdAt: row.createdAt.toISOString() })) };
  }

  @Transactional()
  async review(documentId: string, input: ReviewInput, actor: UserActor, ability: AppAbility) {
    await this.documents.lock(documentId);
    const document = await this.documents.findOne({ id: documentId });
    if (!document || !ability.can(AppAction.Update, 'Document')) throw new AppError(ErrorCode.NOT_FOUND);
    await this.service.get(documentId, ability);
    if (input.outcome === 'rejected') {
      if (!input.rejectReason) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'rejectReason', code: 'required', message: 'say why the document is rejected' }] });
      const next = transitionOrThrow(documentMachine, document.status, DocumentEvent.Reject);
      await this.documents.updateFromStatus(documentId, document.status, { status: next, rejectReason: input.rejectReason, rejectNote: input.note ?? null });
      const extraction = await this.documents.createExtraction({ documentId, extractor: OPS_EXTRACTOR, status: ExtractionStatus.reviewed, fields: json([]), reason: input.note ?? input.rejectReason, reviewedByUserId: actor.userId });
      await this.record(document, AuditAction.DocumentReviewed, EventName.DocumentRejected, next, { extractionId: extraction.id, outcome: input.outcome, rejectReason: input.rejectReason });
      return this.view(documentId);
    }
    const next = transitionOrThrow(documentMachine, document.status, DocumentEvent.Verify);
    const extraction = await this.documents.createExtraction({ documentId, extractor: OPS_EXTRACTOR, status: ExtractionStatus.reviewed, fields: json(input.fields.map((field) => ({ ...field, confidence: 1, page: null }))), reason: input.note ?? null, reviewedByUserId: actor.userId });
    if (input.fields.length > 0) {
      await this.facts.record(document.partyId, input.fields, { provenance: FactProvenance.ops_verified, sourceType: FactSourceType.DocumentExtraction, sourceId: extraction.id, applicationId: document.applicationId ?? undefined, recordedByUserId: actor.userId });
    }
    await this.documents.updateFromStatus(documentId, document.status, { status: next });
    await this.record(document, AuditAction.DocumentReviewed, EventName.DocumentVerified, next, { extractionId: extraction.id, outcome: input.outcome, fields: input.fields.map((field) => field.attributeKey) });
    return this.view(documentId);
  }

  @Transactional()
  private async claim(documentId: string) {
    await this.documents.lock(documentId);
    const document = await this.documents.findOne({ id: documentId });
    if (document?.status !== DocumentStatus.scanned) return null;
    const classifying = transitionOrThrow(documentMachine, document.status, DocumentEvent.Classify);
    const extracting = transitionOrThrow(documentMachine, classifying, DocumentEvent.Extract);
    await this.documents.updateFromStatus(documentId, document.status, { status: extracting });
    return { ...document, status: extracting };
  }

  @Transactional()
  private async finish(document: DocumentRow, outcome: ExtractionOutcome, produces: ReadonlySet<string>): Promise<ExtractOutcome> {
    const accepted = outcome.fields.filter((field) => produces.has(field.attributeKey) && field.confidence >= EXTRACTION_MIN_CONFIDENCE);
    const misclassified = outcome.classifiedAs !== null && outcome.classifiedAs !== document.documentType.key && (outcome.classConfidence ?? 0) >= EXTRACTION_CLASS_MIN_CONFIDENCE;
    const review = outcome.needsReview || misclassified || accepted.length < outcome.fields.length;
    const extraction = await this.documents.createExtraction({
      documentId: document.id,
      extractor: outcome.extractor,
      model: outcome.model,
      promptVersion: outcome.promptVersion,
      status: review ? ExtractionStatus.needs_review : ExtractionStatus.extracted,
      classifiedAs: outcome.classifiedAs,
      classConfidence: outcome.classConfidence,
      fields: json(outcome.fields satisfies ExtractedField[]),
      reason: misclassified ? `classified as ${outcome.classifiedAs}` : outcome.reason,
    });
    if (accepted.length > 0) {
      await this.facts.record(document.partyId, accepted.map((field) => ({ attributeKey: field.attributeKey, value: field.value, confidence: field.confidence })), { provenance: FactProvenance.extracted, sourceType: FactSourceType.DocumentExtraction, sourceId: extraction.id, applicationId: document.applicationId ?? undefined });
    }
    const next = transitionOrThrow(documentMachine, document.status, review ? DocumentEvent.Flag : DocumentEvent.Verify);
    await this.documents.updateFromStatus(document.id, document.status, { status: next });
    await this.record(document, AuditAction.DocumentExtracted, review ? EventName.DocumentNeedsReview : EventName.DocumentVerified, next, { extractionId: extraction.id, extractor: outcome.extractor, fields: accepted.length, reason: extraction.reason });
    return review ? 'needs_review' : 'verified';
  }

  private async record(document: DocumentRow, action: AuditAction, event: EventName, status: DocumentStatus, metadata: Record<string, unknown>) {
    await this.changes.record({ action, entityType: AuditEntity.Document, entityId: document.id, event, metadata, payload: { ...documentEventPayload(document), status } });
  }

  private async view(documentId: string) {
    const document = await this.documents.findOne({ id: documentId });
    if (!document) throw new AppError(ErrorCode.NOT_FOUND);
    return toDocumentView(document);
  }
}
