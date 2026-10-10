import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { CommissionNotificationService } from '../application/commission-notification.service.js';

@Processor(QueueName.CommissionsNotify)
export class CommissionNotifyProcessor extends ContextualProcessor<DomainEventEnvelope, { sent: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly notifications: CommissionNotificationService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ sent: number }> {
    const { payoutId } = (job.data.payload ?? {}) as { payoutId?: string };
    return { sent: payoutId ? await this.notifications.payoutPaid(payoutId) : 0 };
  }
}
