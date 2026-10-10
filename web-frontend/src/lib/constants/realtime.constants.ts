export const REALTIME_NAMESPACE = '/v1/realtime';

export const RealtimeEvent = {
  Ready: 'ready',
  Error: 'error',
  LeadChanged: 'lead.changed',
  AssignmentChanged: 'lead.assignment.changed',
  LeadSla: 'lead.sla',
  ConversionChanged: 'lead.conversion.changed',
  FollowUpDue: 'follow_up.due',
  ImportChanged: 'import.changed',
  DocumentChanged: 'document.changed',
  AnalysisChanged: 'analysis.changed',
  SubmissionChanged: 'submission.changed',
} as const;

export type RealtimeEvent = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export const SyncType = {
  Assignment: 'assignment',
  FollowUp: 'follow_up',
  Lead: 'lead',
} as const;

export const SYNC_PAGE_LIMIT = 200;

export const SYNC_MAX_PAGES = 10;

export const SYNC_CLOCK_SKEW_MS = 5_000;

export const REALTIME_RECONNECT_DELAY_MS = 2_000;

export const NativeBridgeMessage = {
  RequestPushToken: 'fundenflo:request-push-token',
  PushToken: 'fundenflo:push-token',
} as const;

export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;
