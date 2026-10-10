import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { DocumentScanService, type ScanOutcome } from '../application/document-scan.service.js';
import { DOCUMENT_SCAN_CONCURRENCY } from '../domain/document.constants.js';

@Processor(QueueName.DocumentsScan, { concurrency: DOCUMENT_SCAN_CONCURRENCY })
export class DocumentScanProcessor extends ContextualProcessor<DomainEventEnvelope, { outcome: ScanOutcome }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly scans: DocumentScanService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ outcome: ScanOutcome }> {
    const { documentId } = (job.data.payload ?? {}) as { documentId?: string };
    return { outcome: documentId ? await this.scans.scan(documentId) : 'skipped' };
  }
}
