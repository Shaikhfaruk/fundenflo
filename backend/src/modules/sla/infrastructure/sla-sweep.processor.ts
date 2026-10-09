import { Processor } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { SlaService } from '../application/sla.service.js';
import type { SlaFireResult } from '../domain/sla.types.js';

@Processor(QueueName.SlaTimers)
export class SlaSweepProcessor extends ContextualProcessor<unknown, Record<SlaFireResult, number>> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly sla: SlaService,
  ) {
    super(cls);
  }

  protected handle(): Promise<Record<SlaFireResult, number>> {
    return this.sla.sweep();
  }
}
