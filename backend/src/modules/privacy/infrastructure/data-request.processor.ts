import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { DataRequestService } from '../application/data-request.service.js';

@Processor(QueueName.PrivacyRequests)
export class DataRequestProcessor extends ContextualProcessor<DomainEventEnvelope, { exportKey: string | null }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly requests: DataRequestService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ exportKey: string | null }> {
    const { dataRequestId } = (job.data.payload ?? {}) as { dataRequestId?: string };
    return { exportKey: dataRequestId ? await this.requests.buildExport(dataRequestId) : null };
  }
}
