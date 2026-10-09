import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { CLS_ID, ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../common/context/request-context.service.js';

export abstract class ContextualProcessor<T = unknown, R = unknown> extends WorkerHost {
  protected constructor(protected readonly cls: ClsService<RequestContextStore>) {
    super();
  }

  async process(job: Job<T>): Promise<R> {
    return this.cls.run(async () => {
      this.cls.set(CLS_ID, `job:${job.queueName}:${job.id ?? job.name}`);
      this.cls.set('actor', { type: 'system', name: `${job.queueName}:${job.name}` });
      return this.handle(job);
    });
  }

  protected abstract handle(job: Job<T>): Promise<R>;
}
