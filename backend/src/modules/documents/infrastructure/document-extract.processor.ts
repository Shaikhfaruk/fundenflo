import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';
import { ExtractionService } from '../application/extraction.service.js';

@Processor(QueueName.DocumentsExtract)
export class DocumentExtractProcessor extends ContextualProcessor<DomainEventEnvelope, { handled: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly extraction: ExtractionService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ handled: number }> {
    const payload = (job.data.payload ?? {}) as { documentId?: string; partyId?: string; purpose?: string };
    if (job.data.name === EventName.ConsentGranted) return { handled: payload.purpose === ConsentPurposeKey.AiDocuments && payload.partyId ? await this.extraction.extractPending(payload.partyId) : 0 };
    return { handled: payload.documentId && (await this.extraction.extract(payload.documentId)) !== 'skipped' ? 1 : 0 };
  }
}
