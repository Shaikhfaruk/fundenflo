import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { ImportService } from '../application/import.service.js';
import type { ImportJob } from '../domain/import.constants.js';

@Processor(QueueName.ImportsProcess, { concurrency: 1 })
export class ImportProcessor extends ContextualProcessor<{ batchId: string }, { batchId: string }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly imports: ImportService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<{ batchId: string }>): Promise<{ batchId: string }> {
    await this.imports.run(job.data.batchId, job.name as ImportJob);
    return { batchId: job.data.batchId };
  }
}
