import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import { LeadConsentStatus, LeadStatus } from '../../../common/enums/db.enums.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { LeadAssignmentService } from '../application/lead-assignment.service.js';
import { LeadRoutingService } from '../application/lead-routing.service.js';
import { EXPIRE_OFFER_JOB, ROUTE_JOB } from '../domain/lead-routing.constants.js';

type LeadEventPayload = { leadId?: string; to?: LeadStatus; consentStatus?: LeadConsentStatus };

const ROUTE_ON_STATUS: ReadonlySet<string> = new Set([LeadStatus.new, LeadStatus.qualified]);

@Processor(QueueName.LeadsRoute)
export class LeadRoutingProcessor extends ContextualProcessor<DomainEventEnvelope | { leadId?: string; assignmentId?: string }, { outcome: string }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly routing: LeadRoutingService,
    private readonly assignments: LeadAssignmentService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope | { leadId?: string; assignmentId?: string }>): Promise<{ outcome: string }> {
    if (job.name === EXPIRE_OFFER_JOB) {
      const { assignmentId } = job.data as { assignmentId: string };
      return { outcome: (await this.assignments.expire(assignmentId)) ? 'expired' : 'skipped' };
    }
    if (job.name === ROUTE_JOB) {
      const { leadId } = job.data as { leadId: string };
      return { outcome: (await this.routing.route(leadId, { record: false })).outcome };
    }
    const event = job.data as DomainEventEnvelope;
    const payload = event.payload as LeadEventPayload;
    if (!payload.leadId) return { outcome: 'skipped' };
    if (event.name === EventName.LeadStatusChanged && !(payload.to && ROUTE_ON_STATUS.has(payload.to))) return { outcome: 'skipped' };
    if (event.name === EventName.LeadUpdated && payload.consentStatus !== LeadConsentStatus.ok) return { outcome: 'skipped' };
    return { outcome: (await this.routing.route(payload.leadId, { record: false })).outcome };
  }
}
