import { MINUTE_MS } from '../../../common/constants/time.constants.js';
import { DocumentStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import type { SlaTimer } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { SlaHandlerFor } from '../../sla/application/sla-handler.registry.js';
import { SlaService } from '../../sla/application/sla.service.js';
import type { SlaHandler } from '../../sla/domain/sla.types.js';
import { DOCUMENT_SCAN_MAX_ATTEMPTS, DOCUMENT_SCAN_SLA_KIND, DOCUMENT_SCAN_SLA_MINUTES } from '../domain/document.constants.js';
import { DocumentRepository } from '../infrastructure/document.repository.js';
import { documentEventPayload } from './document.service.js';

@SlaHandlerFor(DOCUMENT_SCAN_SLA_KIND)
export class DocumentScanSlaHandler implements SlaHandler {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly sla: SlaService,
    private readonly audit: AuditService,
    private readonly changes: ChangeRecorder,
  ) {}

  async breach(timer: SlaTimer) {
    const document = await this.documents.findOne({ id: timer.entityId });
    if (!document || (document.status !== DocumentStatus.uploaded && document.status !== DocumentStatus.scanning)) return;
    const metadata = { attempts: document.scanAttempts, status: document.status, timerId: timer.id };
    if (document.scanAttempts >= DOCUMENT_SCAN_MAX_ATTEMPTS) {
      await this.audit.record({ action: AuditAction.DocumentScanOverdue, entityType: AuditEntity.Document, entityId: document.id, metadata: { ...metadata, gaveUp: true } });
      return;
    }
    await this.sla.start(DOCUMENT_SCAN_SLA_KIND, { type: AuditEntity.Document, id: document.id }, new Date(Date.now() + DOCUMENT_SCAN_SLA_MINUTES * MINUTE_MS));
    await this.changes.record({ action: AuditAction.DocumentScanOverdue, entityType: AuditEntity.Document, entityId: document.id, event: EventName.DocumentScanOverdue, metadata, payload: documentEventPayload(document) });
  }
}
