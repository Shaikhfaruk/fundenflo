import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { MatchingService } from '../application/matching.service.js';

@Processor(QueueName.MatchingRun)
export class MatchingRunProcessor extends ContextualProcessor<DomainEventEnvelope, { matchRunId: string | null }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly matching: MatchingService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ matchRunId: string | null }> {
    const { applicationId, status } = (job.data.payload ?? {}) as { applicationId?: string; status?: string };
    if (!applicationId || status !== 'scored') return { matchRunId: null };
    return { matchRunId: (await this.matching.run(applicationId, null)).id };
  }
}
