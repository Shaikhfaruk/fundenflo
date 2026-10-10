export const NotificationTemplateKey = {
  AuthOtp: 'auth.otp',
  InvitationStaff: 'invitation.staff',
  InvitationMember: 'invitation.member',
  ConsentRequest: 'consent.request',
  ConsentOtp: 'consent.otp',
  LeadOffered: 'lead.offered',
  LeadOfferExpiring: 'lead.offer_expiring',
  LeadHandedOver: 'lead.handed_over',
  LeadFirstContactDue: 'lead.first_contact_due',
  LeadFirstContactMissed: 'lead.first_contact_missed',
  FollowUpDue: 'follow_up.due',
  AnalysisCompleted: 'analysis.completed',
  ApplicationStatusChanged: 'application.status_changed',
  SubmissionReceived: 'submission.received',
  DocumentRequested: 'document.requested',
  SubmissionStatusChanged: 'submission.status_changed',
  PayoutPaid: 'payout.paid',
} as const;

export type NotificationTemplateKey = (typeof NotificationTemplateKey)[keyof typeof NotificationTemplateKey];

export const TEMPLATE_PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export const NOTIFICATION_DISPATCH_CONCURRENCY = 10;
