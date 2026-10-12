import { NotificationChannel } from '../../../common/enums/db.enums.js';

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

export const OTP_TEMPLATE_KEYS: ReadonlySet<string> = new Set([NotificationTemplateKey.AuthOtp, NotificationTemplateKey.ConsentOtp]);

export const TEMPLATE_PARAMS: Record<NotificationTemplateKey, readonly string[]> = {
  [NotificationTemplateKey.AuthOtp]: ['code', 'minutes'],
  [NotificationTemplateKey.InvitationStaff]: ['expiresOn', 'role', 'token'],
  [NotificationTemplateKey.InvitationMember]: ['expiresOn', 'organization', 'role'],
  [NotificationTemplateKey.ConsentRequest]: ['expiresOn', 'link', 'ref'],
  [NotificationTemplateKey.ConsentOtp]: ['code', 'minutes', 'ref', 'requester'],
  [NotificationTemplateKey.LeadOffered]: ['category', 'city', 'ref', 'respondBy'],
  [NotificationTemplateKey.LeadOfferExpiring]: ['ref', 'respondBy'],
  [NotificationTemplateKey.LeadHandedOver]: ['firstContactBy', 'ref'],
  [NotificationTemplateKey.LeadFirstContactDue]: ['firstContactBy', 'ref'],
  [NotificationTemplateKey.LeadFirstContactMissed]: ['firm', 'firstContactBy', 'ref'],
  [NotificationTemplateKey.FollowUpDue]: ['dueAt', 'ref'],
  [NotificationTemplateKey.AnalysisCompleted]: ['ref'],
  [NotificationTemplateKey.ApplicationStatusChanged]: ['ref', 'status'],
  [NotificationTemplateKey.SubmissionReceived]: ['product', 'ref'],
  [NotificationTemplateKey.DocumentRequested]: ['documents', 'ref'],
  [NotificationTemplateKey.SubmissionStatusChanged]: ['lender', 'ref', 'status'],
  [NotificationTemplateKey.PayoutPaid]: ['account', 'amount', 'ref', 'tds', 'utr'],
};

export const TEMPLATE_REQUIRED_PARAMS: Partial<Record<NotificationTemplateKey, readonly string[]>> = {
  [NotificationTemplateKey.AuthOtp]: ['code'],
  [NotificationTemplateKey.ConsentOtp]: ['code'],
  [NotificationTemplateKey.InvitationStaff]: ['token'],
  [NotificationTemplateKey.ConsentRequest]: ['link'],
};

export const EDITABLE_TEMPLATE_CHANNELS = [NotificationChannel.sms, NotificationChannel.email, NotificationChannel.push] as const;

export const SUBJECT_CHANNELS: readonly NotificationChannel[] = [NotificationChannel.email, NotificationChannel.push];

export const TEMPLATE_SUBJECT_MAX_LENGTH = 200;

export const TEMPLATE_BODY_MAX_LENGTH = 2_000;

export const PROVIDER_TEMPLATE_ID_MAX_LENGTH = 64;
