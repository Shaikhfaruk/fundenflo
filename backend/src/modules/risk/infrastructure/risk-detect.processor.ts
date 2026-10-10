import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { RiskDetectionService } from '../application/risk-detection.service.js';

@Processor(QueueName.RiskDetect)
export class RiskDetectProcessor extends ContextualProcessor<DomainEventEnvelope, { raised: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly detection: RiskDetectionService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ raised: number }> {
    return { raised: await this.detection.handle(job.data) };
  }
}
