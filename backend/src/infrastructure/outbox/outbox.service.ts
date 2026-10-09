import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { RequestContext } from '../../common/context/request-context.service.js';
import type { DomainEventInput } from '../../common/events/domain-event.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaTx } from '../database/database.types.js';

@Injectable()
export class OutboxService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly context: RequestContext,
  ) {}

  async publish(event: DomainEventInput): Promise<void> {
    const actor = this.context.snapshot();
    await this.txHost.tx.outboxEvent.create({
      data: {
        eventName: event.name,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as Prisma.InputJsonValue,
        actor: actor ? (actor as Prisma.InputJsonValue) : undefined,
        requestId: this.context.requestId ?? null,
      },
    });
  }

  async publishAll(events: DomainEventInput[]): Promise<void> {
    for (const event of events) await this.publish(event);
  }
}
