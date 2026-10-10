import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { ApplicationService } from '../application/application.service.js';

@Processor(QueueName.ApplicationsRefresh)
export class ApplicationRefreshProcessor extends ContextualProcessor<DomainEventEnvelope, { refreshed: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly applications: ApplicationService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ refreshed: number }> {
    const { partyId } = (job.data.payload ?? {}) as { partyId?: string };
    return { refreshed: partyId ? await this.applications.refreshForParties([partyId]) : 0 };
  }
}
