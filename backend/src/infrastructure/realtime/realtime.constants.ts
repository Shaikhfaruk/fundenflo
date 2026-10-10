export const REALTIME_NAMESPACE = '/v1/realtime';

export const RealtimeRoom = {
  staff: 'staff',
  user: (id: string) => `user:${id}`,
  session: (id: string) => `session:${id}`,
  membership: (id: string) => `membership:${id}`,
  organization: (id: string) => `org:${id}`,
} as const;

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
