import { Processor } from '@nestjs/bullmq';
import { Emitter } from '@socket.io/redis-emitter';
import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../common/events/domain-event.js';
import { ContextualProcessor } from '../queue/contextual.processor.js';
import { QueueName } from '../queue/queue-names.js';
import { InjectRedis } from '../redis/redis.module.js';
import { REALTIME_NAMESPACE } from './realtime.constants.js';
import { realtimeTargets } from './realtime-routes.js';

@Processor(QueueName.RealtimePublish)
export class RealtimePublishProcessor extends ContextualProcessor<DomainEventEnvelope, { emitted: number }> {
  private readonly emitter: ReturnType<Emitter['of']>;

  constructor(cls: ClsService<RequestContextStore>, @InjectRedis() redis: Redis) {
    super(cls);
    this.emitter = new Emitter(redis).of(REALTIME_NAMESPACE);
  }

  protected handle(job: Job<DomainEventEnvelope>): Promise<{ emitted: number }> {
    let emitted = 0;
    for (const target of realtimeTargets(job.data.name, job.data.payload)) {
      if (target.kind === 'disconnect') {
        this.emitter.in(target.rooms).disconnectSockets(true);
      } else {
        this.emitter.to(target.rooms).emit(target.event, { ...target.data, eventId: job.data.id, occurredAt: job.data.occurredAt });
      }
      emitted += 1;
    }
    return Promise.resolve({ emitted });
  }
}
