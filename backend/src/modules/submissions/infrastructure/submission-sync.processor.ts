import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { SubmissionService } from '../application/submission.service.js';

@Processor(QueueName.SubmissionsSync)
export class SubmissionSyncProcessor extends ContextualProcessor<DomainEventEnvelope, { changed: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly submissions: SubmissionService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ changed: number }> {
    if (job.data.name === EventName.DocumentScanned) return { changed: await this.submissions.onDocumentScanned(job.data.payload) };
    const { applicationId, to } = (job.data.payload ?? {}) as { applicationId?: string; to?: string };
    if (job.data.name === EventName.ApplicationStatusChanged && applicationId && to) return { changed: await this.submissions.onApplicationClosed(applicationId, to) };
    return { changed: 0 };
  }
}
