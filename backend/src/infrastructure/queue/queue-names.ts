export const QueueName = {
  OutboxRelay: 'outbox.relay',
  NotificationsDispatch: 'notifications.dispatch',
  AuthSessionRevocations: 'auth.session-revocations',
  MaintenanceCleanup: 'maintenance.cleanup',
  LeadsConsentSync: 'leads.consent-sync',
  LeadsDropoff: 'leads.dropoff',
  ImportsProcess: 'imports.process',
  LeadsRoute: 'leads.route',
  SlaTimers: 'sla.timers',
  LeadsNotify: 'leads.notify',
  RealtimePublish: 'realtime.publish',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const ALL_QUEUES: QueueName[] = Object.values(QueueName);
