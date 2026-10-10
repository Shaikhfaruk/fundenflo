import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { DocumentStatus } from '../../../common/enums/db.enums.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { DocumentEvent, documentMachine } from '../../../engines/state-machines/machines/document.machine.js';
import { MaintenanceTask } from '../../../infrastructure/maintenance/maintenance-task.decorator.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { DocumentService, documentEventPayload } from '../application/document.service.js';
import { DOCUMENT_RETENTION_BATCH, DocumentPurgeReason } from '../domain/document.constants.js';
import { type DocumentRow, DocumentRepository } from './document.repository.js';

const EXPIRABLE: readonly DocumentStatus[] = [DocumentStatus.scanned, DocumentStatus.verified, DocumentStatus.needs_review];

const FILE_GONE: readonly DocumentStatus[] = [DocumentStatus.deleted, DocumentStatus.purged, DocumentStatus.rejected];

@Injectable()
export class DocumentMaintenance {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly service: DocumentService,
    private readonly changes: ChangeRecorder,
  ) {}

  @MaintenanceTask('documents.freshness-expiry')
  async expireStale(): Promise<number> {
    let expired = 0;
    for (const document of await this.documents.pastFreshness(new Date(), EXPIRABLE, DOCUMENT_RETENTION_BATCH)) if (await this.expire(document)) expired += 1;
    return expired;
  }

  @MaintenanceTask('documents.retention-purge')
  async purgeExpired(): Promise<number> {
    let purged = 0;
    for (const document of await this.documents.pastRetention(new Date(), DOCUMENT_RETENTION_BATCH)) {
      if (await this.purge(document)) {
        await this.service.dropStored(document.id, document.storageKey);
        purged += 1;
      }
    }
    return purged;
  }

  @MaintenanceTask('documents.orphan-files')
  async removeOrphanFiles(): Promise<number> {
    const orphans = await this.documents.orphanFiles(FILE_GONE, DOCUMENT_RETENTION_BATCH);
    for (const orphan of orphans) await this.service.dropStored(orphan.id, orphan.storageKey);
    return orphans.length;
  }

  @Transactional()
  private async expire(document: DocumentRow) {
    const next = transitionOrThrow(documentMachine, document.status, DocumentEvent.Expire);
    const moved = await this.documents.updateFromStatus(document.id, document.status, { status: next });
    if (moved.count === 0) return false;
    await this.changes.record({ action: AuditAction.DocumentExpired, entityType: AuditEntity.Document, entityId: document.id, event: EventName.DocumentExpired, metadata: { documentType: document.documentType.key, freshUntil: document.freshUntil?.toISOString() ?? null }, payload: { ...documentEventPayload(document), status: next } });
    return true;
  }

  @Transactional()
  private async purge(document: DocumentRow) {
    const next = transitionOrThrow(documentMachine, document.status, DocumentEvent.Purge);
    const moved = await this.documents.updateFromStatus(document.id, document.status, { status: next, deletedAt: document.deletedAt ?? new Date(), passwordEnc: null });
    if (moved.count === 0) return false;
    await this.changes.record({ action: AuditAction.DocumentPurged, entityType: AuditEntity.Document, entityId: document.id, event: EventName.DocumentPurged, metadata: { documentType: document.documentType.key, reason: DocumentPurgeReason.Retention, retentionUntil: document.retentionUntil?.toISOString() ?? null }, payload: { ...documentEventPayload(document), status: next } });
    return true;
  }
}
