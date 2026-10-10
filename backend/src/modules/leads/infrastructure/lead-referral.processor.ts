import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { ReferralSignupService } from '../application/referral-signup.service.js';

@Processor(QueueName.LeadsReferrals)
export class LeadReferralProcessor extends ContextualProcessor<DomainEventEnvelope, { outcome: string | null }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly referrals: ReferralSignupService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ outcome: string | null }> {
    return { outcome: (await this.referrals.onSignedUp(job.data.payload ?? {}))?.outcome ?? null };
  }
}
