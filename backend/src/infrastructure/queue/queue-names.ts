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
  DocumentsScan: 'documents.scan',
  ApplicationsRefresh: 'applications.refresh',
  AnalysisRun: 'analysis.run',
  NotificationsSubscriptions: 'notifications.subscriptions',
  DocumentsExtract: 'documents.extract',
  MatchingRun: 'matching.run',
  SubmissionsDeliver: 'submissions.deliver',
  SubmissionsSync: 'submissions.sync',
  SubmissionsNotify: 'submissions.notify',
  LeadsReferrals: 'leads.referrals',
  CommissionsAccrue: 'commissions.accrue',
  CommissionsNotify: 'commissions.notify',
  RiskDetect: 'risk.detect',
  PrivacyRequests: 'privacy.requests',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const ALL_QUEUES: QueueName[] = Object.values(QueueName);
