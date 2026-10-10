import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { LeadNotificationService } from '../application/lead-notification.service.js';

@Processor(QueueName.LeadsNotify)
export class LeadNotifyProcessor extends ContextualProcessor<DomainEventEnvelope, { sent: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly notifications: LeadNotificationService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ sent: number }> {
    return { sent: await this.notifications.handle(job.data) };
  }
}
