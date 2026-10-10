import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { DocumentRejectReason, DocumentStatus } from '../../../common/enums/db.enums.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { DocumentEvent, documentMachine } from '../../../engines/state-machines/machines/document.machine.js';
import { type AntivirusScanner, InjectAntivirusScanner, type ScanVerdict } from '../../../integrations/antivirus/antivirus.port.js';
import { InjectObjectStorage, type ObjectStorage } from '../../../infrastructure/storage/storage.port.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { SlaService } from '../../sla/application/sla.service.js';
import { DOCUMENT_SCAN_SLA_KIND } from '../domain/document.constants.js';
import { DocumentRepository } from '../infrastructure/document.repository.js';
import { documentEventPayload, DocumentService } from './document.service.js';

export type ScanOutcome = 'clean' | 'infected' | 'missing' | 'skipped';

const MISSING_FILE_NOTE = 'The uploaded file could not be found. Upload it again.';

@Injectable()
export class DocumentScanService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly service: DocumentService,
    private readonly sla: SlaService,
    private readonly changes: ChangeRecorder,
    @InjectAntivirusScanner() private readonly scanner: AntivirusScanner,
    @InjectObjectStorage() private readonly storage: ObjectStorage,
  ) {}

  async scan(documentId: string): Promise<ScanOutcome> {
    const claimed = await this.claim(documentId);
    if (!claimed) return 'skipped';
    if (!(await this.storage.exists(claimed.storageKey))) {
      await this.finish(documentId, null);
      return 'missing';
    }
    const verdict = await this.scanner.scan(await this.storage.read(claimed.storageKey));
    const outcome = await this.finish(documentId, verdict);
    if (outcome === 'infected') await this.service.dropStored(documentId, claimed.storageKey);
    return outcome;
  }

  @Transactional()
  private async claim(documentId: string) {
    await this.documents.lock(documentId);
    const document = await this.documents.findOne({ id: documentId });
    if (!document || (document.status !== DocumentStatus.uploaded && document.status !== DocumentStatus.scanning)) return null;
    const status = document.status === DocumentStatus.uploaded ? transitionOrThrow(documentMachine, document.status, DocumentEvent.StartScan) : document.status;
    await this.documents.update(documentId, { status, scanAttempts: { increment: 1 } });
    return document;
  }

  @Transactional()
  private async finish(documentId: string, verdict: ScanVerdict | null): Promise<ScanOutcome> {
    await this.documents.lock(documentId);
    const document = await this.documents.findOne({ id: documentId });
    if (document?.status !== DocumentStatus.scanning) return 'skipped';
    const clean = verdict?.clean === true;
    const next = transitionOrThrow(documentMachine, document.status, clean ? DocumentEvent.PassScan : DocumentEvent.FailScan);
    const rejectReason = verdict ? DocumentRejectReason.infected : DocumentRejectReason.other;
    await this.documents.updateFromStatus(documentId, document.status, {
      status: next,
      scannedAt: new Date(),
      scanEngine: verdict?.engine ?? null,
      scanSignature: verdict?.signature ?? null,
      ...(clean ? {} : { rejectReason, rejectNote: verdict ? null : MISSING_FILE_NOTE }),
    });
    await this.sla.satisfy(DOCUMENT_SCAN_SLA_KIND, documentId);
    await this.changes.record({
      action: clean ? AuditAction.DocumentScanned : AuditAction.DocumentRejected,
      entityType: AuditEntity.Document,
      entityId: documentId,
      event: clean ? EventName.DocumentScanned : EventName.DocumentRejected,
      metadata: { engine: verdict?.engine ?? null, signature: verdict?.signature ?? null, attempts: document.scanAttempts, reason: clean ? null : rejectReason },
      payload: { ...documentEventPayload(document), status: next, rejectReason: clean ? null : rejectReason },
    });
    if (clean) return 'clean';
    return verdict ? 'infected' : 'missing';
  }
}
