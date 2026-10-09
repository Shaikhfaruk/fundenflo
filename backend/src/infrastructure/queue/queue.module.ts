import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { DEFAULT_JOB_OPTIONS } from './queue.constants.js';
import { ALL_QUEUES } from './queue-names.js';
import { QueueRegistry } from './queue-registry.service.js';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
  ],
  providers: [QueueRegistry],
  exports: [BullModule, QueueRegistry],
})
export class QueueModule {}
