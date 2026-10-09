import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { JobSchedulerId, MAINTENANCE_CRON, OUTBOX_RELAY_INTERVAL_MS, SLA_SWEEP_INTERVAL_MS } from './infrastructure/queue/queue.constants.js';
import { QueueName } from './infrastructure/queue/queue-names.js';
import { QueueRegistry } from './infrastructure/queue/queue-registry.service.js';

@Injectable()
export class WorkerScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkerScheduler.name);

  constructor(private readonly queues: QueueRegistry) {}

  async onApplicationBootstrap() {
    await this.queues.get(QueueName.OutboxRelay).upsertJobScheduler(
      JobSchedulerId.OutboxRelay,
      { every: OUTBOX_RELAY_INTERVAL_MS },
      { name: 'relay', opts: { removeOnComplete: true, removeOnFail: 100, attempts: 1 } },
    );
    await this.queues.get(QueueName.MaintenanceCleanup).upsertJobScheduler(
      JobSchedulerId.MaintenanceCleanup,
      { pattern: MAINTENANCE_CRON },
      { name: 'cleanup', opts: { removeOnComplete: 100, removeOnFail: 100, attempts: 1 } },
    );
    await this.queues.get(QueueName.SlaTimers).upsertJobScheduler(
      JobSchedulerId.SlaSweep,
      { every: SLA_SWEEP_INTERVAL_MS },
      { name: 'sweep', opts: { removeOnComplete: true, removeOnFail: 100, attempts: 1 } },
    );
    this.logger.log('Job schedulers registered');
  }
}
