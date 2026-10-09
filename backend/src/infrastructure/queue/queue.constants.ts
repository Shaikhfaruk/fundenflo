import type { DefaultJobOptions } from 'bullmq';

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { age: 24 * 3600, count: 10_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

export const JobPriority = {
  Critical: 1,
  High: 5,
  Normal: 10,
  Low: 20,
} as const;

export const OUTBOX_RELAY_INTERVAL_MS = 1_000;

export const OUTBOX_RELAY_BATCH_SIZE = 200;

export const MAINTENANCE_CRON = '0 * * * *';

export const JobSchedulerId = {
  OutboxRelay: 'outbox-relay',
  MaintenanceCleanup: 'maintenance-cleanup',
} as const;
