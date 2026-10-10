import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { SubmissionService } from '../application/submission.service.js';

@Processor(QueueName.SubmissionsDeliver)
export class SubmissionDeliverProcessor extends ContextualProcessor<DomainEventEnvelope, { delivered: boolean; packetId: string | null }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly submissions: SubmissionService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ delivered: boolean; packetId: string | null }> {
    const { submissionId } = (job.data.payload ?? {}) as { submissionId?: string };
    return submissionId ? this.submissions.deliver(submissionId) : { delivered: false, packetId: null };
  }
}
