import { Processor } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';

import type { ActorSnapshot } from '../../common/context/actor.js';
import type { RequestContextStore } from '../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../common/events/domain-event.js';
import type { EventName } from '../../common/events/event-names.js';
import { PrismaService } from '../database/prisma.service.js';
import { ContextualProcessor } from '../queue/contextual.processor.js';
import { EVENT_ROUTES } from '../queue/event-routes.js';
import { OUTBOX_RELAY_BATCH_SIZE } from '../queue/queue.constants.js';
import { QueueName } from '../queue/queue-names.js';
import { QueueRegistry } from '../queue/queue-registry.service.js';

type OutboxRow = {
  id: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  actor: ActorSnapshot | null;
  requestId: string | null;
  occurredAt: Date;
};

@Processor(QueueName.OutboxRelay, { concurrency: 1 })
export class OutboxRelayProcessor extends ContextualProcessor<unknown, { published: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly prisma: PrismaService,
    private readonly queues: QueueRegistry,
  ) {
    super(cls);
  }

  protected async handle(): Promise<{ published: number }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<OutboxRow[]>`
        SELECT id, event_name AS "eventName", aggregate_type AS "aggregateType", aggregate_id AS "aggregateId",
               payload, actor, request_id AS "requestId", occurred_at AS "occurredAt"
        FROM outbox_events
        WHERE published_at IS NULL
        ORDER BY occurred_at, id
        LIMIT ${OUTBOX_RELAY_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED`;
      if (rows.length === 0) return { published: 0 };

      for (const row of rows) {
        const envelope: DomainEventEnvelope = {
          id: row.id,
          name: row.eventName as EventName,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          payload: row.payload,
          actor: row.actor,
          requestId: row.requestId,
          occurredAt: row.occurredAt.toISOString(),
        };
        for (const queueName of EVENT_ROUTES[envelope.name] ?? []) {
          await this.queues.get(queueName).add(envelope.name, envelope, { jobId: row.id });
        }
      }

      await tx.outboxEvent.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { publishedAt: new Date(), attempts: { increment: 1 } },
      });
      return { published: rows.length };
    });
  }
}
