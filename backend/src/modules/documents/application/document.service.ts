import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';

import { DAY_MS, MINUTE_MS } from '../../../common/constants/time.constants.js';
import type { UserActor } from '../../../common/context/actor.js';
import { DocumentSource, type DocumentStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { displayFileName, safeFileName } from '../../../common/utils/file-name.js';
import { parseOrThrow } from '../../../common/validation/zod-validation.pipe.js';
import { sniffMimeType } from '../../../engines/documents/file-signature.js';
import { CLEAN_DOCUMENT_STATES, DocumentEvent, documentMachine, REMOVED_DOCUMENT_STATES } from '../../../engines/state-machines/machines/document.machine.js';
import { RateLimiter } from '../../../infrastructure/rate-limit/rate-limiter.service.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { InjectObjectStorage, type ObjectStorage } from '../../../infrastructure/storage/storage.port.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { SlaService } from '../../sla/application/sla.service.js';
import {
  DOCUMENT_ACTIVE_PER_PARTY_MAX,
  DOCUMENT_FALLBACK_FILE_NAME,
  DOCUMENT_READ_URL_TTL_SECONDS,
  DOCUMENT_SCAN_SLA_KIND,
  DOCUMENT_SCAN_SLA_MINUTES,
  DOCUMENT_UPLOAD_RATE_LIMIT,
  DocumentOwnerKind,
} from '../domain/document.constants.js';
import { type UploadFields, uploadFieldsSchema } from '../domain/document-upload.schema.js';
import type { StagedUpload } from '../infrastructure/document-upload.engine.js';
import { type DocumentRow, DocumentRepository } from '../infrastructure/document.repository.js';
import { DocumentOwnerRegistry } from './document-owner.registry.js';
import { toDocumentView } from './document.views.js';
import { DocumentTypeService } from './document-type.service.js';

export type DocumentListQuery = PageQuery & { applicationId?: string; borrowerProfileId?: string; status?: DocumentStatus; documentType?: string };

const later = (from: Date, milliseconds: number) => new Date(from.getTime() + milliseconds);

export const documentEventPayload = (document: DocumentRow) => ({
  documentId: document.id,
  documentType: document.documentType.key,
  partyId: document.partyId,
  borrowerProfileId: document.borrowerProfileId,
  applicationId: document.applicationId,
  partnerOrganizationId: document.partnerOrganizationId,
  uploadedByUserId: document.uploadedByUserId,
  status: document.status,
});

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly documents: DocumentRepository,
    private readonly types: DocumentTypeService,
    private readonly owners: DocumentOwnerRegistry,
    private readonly cipher: FieldCipher,
    private readonly limiter: RateLimiter,
    private readonly sla: SlaService,
    private readonly audit: AuditService,
    private readonly changes: ChangeRecorder,
    @InjectObjectStorage() private readonly storage: ObjectStorage,
  ) {}

  async upload(file: StagedUpload | undefined, fields: unknown, actor: UserActor, ability: AppAbility) {
    if (!file) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'file', code: 'required', message: 'attach the document file' }] });
    try {
      const result = await this.register(file, parseOrThrow(uploadFieldsSchema, fields), actor, ability);
      if (result.duplicate) await this.discard(file.storageKey);
      return toDocumentView(result.document);
    } catch (error) {
      await this.discard(file.storageKey);
      throw error;
    }
  }

  async list(ability: AppAbility, query: DocumentListQuery) {
    const window = pageWindow(query);
    const rows = await this.documents.list(
      {
        AND: [
          accessibleBy(ability, AppAction.Read).ofType('Document'),
          {
            id: window.idFilter,
            applicationId: query.applicationId,
            borrowerProfileId: query.borrowerProfileId,
            status: query.status ?? { notIn: [...REMOVED_DOCUMENT_STATES] },
            ...(query.documentType ? { documentType: { key: query.documentType } } : {}),
          },
        ],
      },
      window.take,
    );
    return toPage(rows, query.limit, toDocumentView);
  }

  async heldTypes(partyId: string, applicationId: string): Promise<Set<string>> {
    return new Set((await this.documents.heldFor(partyId, applicationId)).map((document) => document.documentType.key));
  }

  async analysable(partyId: string, applicationId: string) {
    return (await this.documents.heldFor(partyId, applicationId)).filter((document) => CLEAN_DOCUMENT_STATES.includes(document.status));
  }

  async get(id: string, ability: AppAbility) {
    return toDocumentView(await this.visible(id, ability, AppAction.Read));
  }

  async downloadUrl(id: string, ability: AppAbility) {
    const document = await this.visible(id, ability, AppAction.Download);
    if (!CLEAN_DOCUMENT_STATES.includes(document.status)) throw new AppError(ErrorCode.DOCUMENT_NOT_READY, { details: { status: document.status } });
    const url = await this.storage.createReadUrl(document.storageKey, { ttlSeconds: DOCUMENT_READ_URL_TTL_SECONDS, downloadName: safeFileName(document.fileName), contentType: document.mimeType });
    await this.audit.record({ action: AuditAction.DocumentDownloadUrlIssued, entityType: AuditEntity.Document, entityId: document.id, metadata: { documentType: document.documentType.key, ttlSeconds: DOCUMENT_READ_URL_TTL_SECONDS } });
    return { url, expiresAt: later(new Date(), DOCUMENT_READ_URL_TTL_SECONDS * 1000).toISOString() };
  }

  async remove(id: string, actor: UserActor, ability: AppAbility) {
    const document = await this.markDeleted(id, actor, ability);
    await this.dropStored(document.id, document.storageKey);
  }

  async dropStored(id: string, storageKey: string) {
    try {
      await this.storage.delete(storageKey);
      await this.documents.update(id, { storageDeletedAt: new Date() });
    } catch (error) {
      this.logger.warn({ err: error, documentId: id }, 'Stored file was not removed; the retention sweep will retry');
    }
  }

  @Transactional()
  private async register(file: StagedUpload, fields: UploadFields, actor: UserActor, ability: AppAbility) {
    const limit = await this.limiter.consume(`document-upload:user:${actor.userId}`, DOCUMENT_UPLOAD_RATE_LIMIT.limit, DOCUMENT_UPLOAD_RATE_LIMIT.windowSeconds);
    if (!limit.allowed) throw new AppError(ErrorCode.RATE_LIMITED, { retryAfterSeconds: limit.retryAfterSeconds });
    const [kind, ownerId] = fields.applicationId ? [DocumentOwnerKind.Application, fields.applicationId] : fields.lenderId ? [DocumentOwnerKind.Lender, fields.lenderId] : [DocumentOwnerKind.BorrowerProfile, fields.borrowerProfileId as string];
    const scope = await this.owners.get(kind).scopeForUpload(ownerId, ability);
    const type = (await this.types.activeByKeys([fields.documentType])).get(fields.documentType);
    if (!type) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'documentType', code: 'unknown_key', message: `unknown or inactive document type ${fields.documentType}` }] });
    if (file.sizeBytes === 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'file', code: 'empty', message: 'the file is empty' }] });
    const mimeType = sniffMimeType(file.head, { fileName: file.originalname, declared: file.mimetype });
    if (!mimeType || !type.acceptedMimeTypes.includes(mimeType)) throw new AppError(ErrorCode.FILE_TYPE_NOT_ALLOWED, { details: { detected: mimeType, accepted: type.acceptedMimeTypes } });
    if (file.sizeBytes > type.maxSizeBytes) throw new AppError(ErrorCode.PAYLOAD_TOO_LARGE, { details: { sizeBytes: file.sizeBytes, maxSizeBytes: type.maxSizeBytes } });

    const duplicate = await this.documents.findActiveDuplicate({ partyId: scope.partyId, sha256: file.sha256, documentTypeId: type.id, applicationId: scope.applicationId });
    if (duplicate) return { document: duplicate, duplicate: true };
    if ((await this.documents.countActive(scope.partyId)) >= DOCUMENT_ACTIVE_PER_PARTY_MAX) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'file', code: 'too_many_documents', message: `remove an old document first; at most ${DOCUMENT_ACTIVE_PER_PARTY_MAX} are kept` }] });
    }
    const now = new Date();
    const document = await this.documents.create({
      documentTypeId: type.id,
      ...scope,
      source: DocumentSource.upload,
      storageKey: file.storageKey,
      fileName: displayFileName(file.originalname, DOCUMENT_FALLBACK_FILE_NAME),
      mimeType,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      passwordEnc: fields.password ? this.cipher.encrypt(fields.password, CipherPurpose.DocumentPassword) : null,
      freshUntil: type.freshnessDays ? later(now, type.freshnessDays * DAY_MS) : null,
      retentionUntil: type.retentionDays ? later(now, type.retentionDays * DAY_MS) : null,
      uploadedByUserId: actor.userId,
      uploadedContext: actor.context,
    });
    await this.sla.start(DOCUMENT_SCAN_SLA_KIND, { type: AuditEntity.Document, id: document.id }, later(now, DOCUMENT_SCAN_SLA_MINUTES * MINUTE_MS));
    await this.changes.record({
      action: AuditAction.DocumentUploaded,
      entityType: AuditEntity.Document,
      entityId: document.id,
      event: EventName.DocumentUploaded,
      metadata: { documentType: type.key, mimeType, sizeBytes: file.sizeBytes, applicationId: scope.applicationId, borrowerProfileId: scope.borrowerProfileId },
      payload: documentEventPayload(document),
    });
    return { document, duplicate: false };
  }

  @Transactional()
  private async markDeleted(id: string, actor: UserActor, ability: AppAbility) {
    await this.documents.lock(id);
    const document = await this.visible(id, ability, AppAction.Delete);
    if (document.lockedAt) throw new AppError(ErrorCode.DOCUMENT_LOCKED);
    const next = transitionOrThrow(documentMachine, document.status, DocumentEvent.Delete);
    const moved = await this.documents.updateFromStatus(id, document.status, { status: next, deletedAt: new Date(), deletedByUserId: actor.userId });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.sla.cancel(id, [DOCUMENT_SCAN_SLA_KIND]);
    await this.changes.record({
      action: AuditAction.DocumentDeleted,
      entityType: AuditEntity.Document,
      entityId: id,
      event: EventName.DocumentDeleted,
      metadata: { documentType: document.documentType.key, from: document.status },
      payload: { ...documentEventPayload(document), status: next },
    });
    return document;
  }

  private async visible(id: string, ability: AppAbility, action: AppAction) {
    const document = await this.documents.findOne({ AND: [accessibleBy(ability, action).ofType('Document'), { id }] });
    if (!document) throw new AppError(ErrorCode.NOT_FOUND);
    return document;
  }

  private async discard(storageKey: string) {
    try {
      await this.storage.delete(storageKey);
    } catch (error) {
      this.logger.warn({ err: error, storageKey }, 'Staged upload was not removed');
    }
  }
}
