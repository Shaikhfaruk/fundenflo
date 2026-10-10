import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { SubscriptionService } from '../application/subscription.service.js';
import { SubscriptionEvent } from '../domain/subscription.constants.js';

const EVENTS: Partial<Record<string, SubscriptionEvent>> = {
  [EventName.AnalysisCompleted]: SubscriptionEvent.AnalysisCompleted,
  [EventName.ApplicationStatusChanged]: SubscriptionEvent.ApplicationStatusChanged,
};

@Processor(QueueName.NotificationsSubscriptions)
export class SubscriptionDeliveryProcessor extends ContextualProcessor<DomainEventEnvelope, { sent: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly subscriptions: SubscriptionService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ sent: number }> {
    const event = EVENTS[job.data.name];
    return { sent: event ? await this.subscriptions.deliver(event, job.data.payload ?? {}) : 0 };
  }
}
