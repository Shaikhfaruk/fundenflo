import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { CommissionService } from '../application/commission.service.js';

@Processor(QueueName.CommissionsAccrue)
export class CommissionAccrueProcessor extends ContextualProcessor<DomainEventEnvelope, { receivableId: string | null; payoutId: string | null }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly commissions: CommissionService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ receivableId: string | null; payoutId: string | null }> {
    return (await this.commissions.accrue(job.data.id, job.data.payload ?? {})) ?? { receivableId: null, payoutId: null };
  }
}
