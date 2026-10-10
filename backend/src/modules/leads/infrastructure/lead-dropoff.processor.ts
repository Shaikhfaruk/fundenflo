import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import { LoginAs } from '../../../common/enums/db.enums.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { InjectConfig } from '../../../config/config.constants.js';
import type { AppConfig } from '../../../config/env.schema.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { QueueRegistry } from '../../../infrastructure/queue/queue-registry.service.js';
import { LeadCaptureService } from '../application/lead-capture.service.js';
import { LeadSourceService } from '../application/lead-source.service.js';
import { DROPOFF_CHECK_JOB, LeadSourceKey } from '../domain/lead.constants.js';
import { HOUR_MS } from '../../../common/constants/time.constants.js';

type SignedUpPayload = { userId: string; partyId: string; loginAs: LoginAs };

type DropoffCheck = { userId: string; partyId: string };

type DropoffResult = { scheduled?: boolean; captured?: string | null; skipped?: string };

@Processor(QueueName.LeadsDropoff)
export class LeadDropoffProcessor extends ContextualProcessor<DomainEventEnvelope | DropoffCheck, DropoffResult> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly queues: QueueRegistry,
    private readonly capture: LeadCaptureService,
    private readonly sources: LeadSourceService,
    @InjectConfig() private readonly config: AppConfig,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope | DropoffCheck>): Promise<DropoffResult> {
    if (job.name === EventName.UserSignedUp) {
      const payload = (job.data as DomainEventEnvelope).payload as SignedUpPayload;
      if (payload.loginAs !== LoginAs.borrower) return { skipped: 'not a borrower sign-up' };
      await this.queues.get(QueueName.LeadsDropoff).add(
        DROPOFF_CHECK_JOB,
        { userId: payload.userId, partyId: payload.partyId } satisfies DropoffCheck,
        { delay: this.config.LEAD_DROPOFF_DELAY_HOURS * HOUR_MS, jobId: `dropoff-${payload.userId}` },
      );
      return { scheduled: true };
    }
    const check = job.data as DropoffCheck;
    const result = await this.capture.captureDropoff(check.partyId, await this.sources.activeByKey(LeadSourceKey.AppDropoff));
    return { captured: result?.lead.id ?? null };
  }
}
