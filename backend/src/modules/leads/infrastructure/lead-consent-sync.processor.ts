import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { LeadService } from '../application/lead.service.js';

@Processor(QueueName.LeadsConsentSync)
export class LeadConsentSyncProcessor extends ContextualProcessor<DomainEventEnvelope, { updated: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly leads: LeadService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ updated: number }> {
    const { partyId, sourcePartyId } = (job.data.payload ?? {}) as { partyId?: string; sourcePartyId?: string };
    let updated = 0;
    for (const id of new Set([partyId, job.data.name === EventName.PartyMergeReverted ? sourcePartyId : undefined])) if (id) updated += await this.leads.refreshConsentStatus(id);
    return { updated };
  }
}
