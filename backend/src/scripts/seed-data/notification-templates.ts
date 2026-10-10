import { NotificationChannel } from '../../common/enums/db.enums.js';
import { NotificationTemplateKey } from '../../modules/notifications/domain/notification.constants.js';

export type TemplateSeed = {
  key: string;
  channel: NotificationChannel;
  locale: string;
  subject: string | null;
  body: string;
};

export const DLT_TEMPLATE_ENV: Partial<Record<NotificationTemplateKey, string>> = {
  [NotificationTemplateKey.AuthOtp]: 'SMS_DLT_TEMPLATE_AUTH_OTP',
  [NotificationTemplateKey.InvitationMember]: 'SMS_DLT_TEMPLATE_INVITATION_MEMBER',
  [NotificationTemplateKey.ConsentRequest]: 'SMS_DLT_TEMPLATE_CONSENT_REQUEST',
  [NotificationTemplateKey.ConsentOtp]: 'SMS_DLT_TEMPLATE_CONSENT_OTP',
  [NotificationTemplateKey.LeadOffered]: 'SMS_DLT_TEMPLATE_LEAD_OFFERED',
  [NotificationTemplateKey.LeadOfferExpiring]: 'SMS_DLT_TEMPLATE_LEAD_OFFER_EXPIRING',
  [NotificationTemplateKey.LeadHandedOver]: 'SMS_DLT_TEMPLATE_LEAD_HANDED_OVER',
  [NotificationTemplateKey.LeadFirstContactDue]: 'SMS_DLT_TEMPLATE_LEAD_FIRST_CONTACT_DUE',
  [NotificationTemplateKey.FollowUpDue]: 'SMS_DLT_TEMPLATE_FOLLOW_UP_DUE',
  [NotificationTemplateKey.AnalysisCompleted]: 'SMS_DLT_TEMPLATE_ANALYSIS_COMPLETED',
  [NotificationTemplateKey.ApplicationStatusChanged]: 'SMS_DLT_TEMPLATE_APPLICATION_STATUS',
  [NotificationTemplateKey.DocumentRequested]: 'SMS_DLT_TEMPLATE_DOCUMENT_REQUESTED',
  [NotificationTemplateKey.SubmissionReceived]: 'SMS_DLT_TEMPLATE_SUBMISSION_RECEIVED',
  [NotificationTemplateKey.SubmissionStatusChanged]: 'SMS_DLT_TEMPLATE_SUBMISSION_STATUS',
  [NotificationTemplateKey.PayoutPaid]: 'SMS_DLT_TEMPLATE_PAYOUT_PAID',
};

export const NOTIFICATION_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    key: NotificationTemplateKey.AuthOtp,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: '{{code}} is your FundenFlo verification code. It expires in {{minutes}} minutes. Do not share this code with anyone.',
  },
  {
    key: NotificationTemplateKey.AuthOtp,
    channel: NotificationChannel.email,
    locale: 'en',
    subject: 'Your FundenFlo verification code',
    body: 'Your FundenFlo verification code is {{code}}.\n\nIt expires in {{minutes}} minutes. If you did not ask for this code, you can ignore this email.',
  },
  {
    key: NotificationTemplateKey.InvitationStaff,
    channel: NotificationChannel.email,
    locale: 'en',
    subject: 'You are invited to the FundenFlo team',
    body: 'You have been invited to join the FundenFlo team as {{role}}.\n\nUse this invitation code to set your password: {{token}}\n\nThe invitation expires on {{expiresOn}}.',
  },
  {
    key: NotificationTemplateKey.InvitationMember,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: 'You have been invited to join {{organization}} on FundenFlo as {{role}}. Sign in with this mobile number before {{expiresOn}} to accept.',
  },
  {
    key: NotificationTemplateKey.InvitationMember,
    channel: NotificationChannel.email,
    locale: 'en',
    subject: 'You are invited to {{organization}} on FundenFlo',
    body: 'You have been invited to join {{organization}} on FundenFlo as {{role}}.\n\nSign in with this email address before {{expiresOn}} to accept.',
  },
  {
    key: NotificationTemplateKey.ConsentRequest,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: 'FundenFlo: please confirm how we may help with your loan enquiry {{ref}}: {{link}} The link expires on {{expiresOn}}.',
  },
  {
    key: NotificationTemplateKey.ConsentOtp,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: '{{code}} is your FundenFlo consent code. {{requester}} added you to loan application {{ref}}. Share it only if you agree. It expires in {{minutes}} minutes.',
  },
  {
    key: NotificationTemplateKey.LeadOffered,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: 'FundenFlo: new {{category}} lead {{ref}} in {{city}} for your firm. Accept or decline in the partner app before {{respondBy}}.',
  },
  {
    key: NotificationTemplateKey.LeadOffered,
    channel: NotificationChannel.email,
    locale: 'en',
    subject: 'New lead {{ref}} for your firm',
    body: 'A new {{category}} lead ({{ref}}) in {{city}} has been offered to your firm on FundenFlo.\n\nAccept or decline it in the partner app before {{respondBy}}. After that it moves to another partner.',
  },
  {
    key: NotificationTemplateKey.LeadOfferExpiring,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: 'FundenFlo: lead {{ref}} offered to your firm expires at {{respondBy}}. Accept or decline it in the partner app.',
  },
  {
    key: NotificationTemplateKey.LeadHandedOver,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: 'FundenFlo: lead {{ref}} has been assigned to you by your firm. Please contact the borrower before {{firstContactBy}}.',
  },
  {
    key: NotificationTemplateKey.LeadHandedOver,
    channel: NotificationChannel.email,
    locale: 'en',
    subject: 'Lead {{ref}} assigned to you',
    body: 'Your firm has assigned lead {{ref}} to you on FundenFlo.\n\nPlease contact the borrower before {{firstContactBy}} and log the call in the partner app.',
  },
  {
    key: NotificationTemplateKey.LeadFirstContactDue,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: 'FundenFlo: please contact the borrower for lead {{ref}} before {{firstContactBy}} and log the call in the partner app.',
  },
  {
    key: NotificationTemplateKey.LeadFirstContactMissed,
    channel: NotificationChannel.email,
    locale: 'en',
    subject: 'First contact missed on lead {{ref}}',
    body: '{{firm}} accepted lead {{ref}} but did not log a first contact by {{firstContactBy}}.\n\nThe lead is flagged first_contact_missed in the ops queue.',
  },
  {
    key: NotificationTemplateKey.FollowUpDue,
    channel: NotificationChannel.sms,
    locale: 'en',
    subject: null,
    body: 'FundenFlo reminder: follow-up on lead {{ref}} is due at {{dueAt}}.',
  },
  { key: NotificationTemplateKey.LeadOffered, channel: NotificationChannel.push, locale: 'en', subject: 'New lead {{ref}}', body: '{{category}} lead in {{city}}. Accept or decline before {{respondBy}}.' },
  { key: NotificationTemplateKey.LeadOfferExpiring, channel: NotificationChannel.push, locale: 'en', subject: 'Lead {{ref}} expires soon', body: 'Accept or decline before {{respondBy}}, or it moves to another partner.' },
  { key: NotificationTemplateKey.LeadHandedOver, channel: NotificationChannel.push, locale: 'en', subject: 'Lead {{ref}} assigned to you', body: 'Contact the borrower before {{firstContactBy}}.' },
  { key: NotificationTemplateKey.LeadFirstContactDue, channel: NotificationChannel.push, locale: 'en', subject: 'Call the borrower for {{ref}}', body: 'First contact is due by {{firstContactBy}}.' },
  { key: NotificationTemplateKey.FollowUpDue, channel: NotificationChannel.push, locale: 'en', subject: 'Follow-up due', body: 'Follow-up on lead {{ref}} is due at {{dueAt}}.' },
  { key: NotificationTemplateKey.AnalysisCompleted, channel: NotificationChannel.push, locale: 'en', subject: 'Your assessment is ready', body: 'Open FundenFlo to see your financial health score for {{ref}}.' },
  { key: NotificationTemplateKey.AnalysisCompleted, channel: NotificationChannel.sms, locale: 'en', subject: null, body: 'FundenFlo: your financial health assessment for {{ref}} is ready. Open the app to see your score.' },
  { key: NotificationTemplateKey.ApplicationStatusChanged, channel: NotificationChannel.push, locale: 'en', subject: 'Update on {{ref}}', body: 'Your application is now {{status}}.' },
  { key: NotificationTemplateKey.ApplicationStatusChanged, channel: NotificationChannel.sms, locale: 'en', subject: null, body: 'FundenFlo: your loan application {{ref}} is now {{status}}.' },
  { key: NotificationTemplateKey.SubmissionReceived, channel: NotificationChannel.email, locale: 'en', subject: 'New application {{ref}} on FundenFlo', body: 'A new application ({{ref}}) for {{product}} is waiting for you on the FundenFlo lender portal.' },
  { key: NotificationTemplateKey.SubmissionReceived, channel: NotificationChannel.push, locale: 'en', subject: 'New application {{ref}}', body: '{{product}}: open the lender portal to review it.' },
  { key: NotificationTemplateKey.SubmissionReceived, channel: NotificationChannel.sms, locale: 'en', subject: null, body: 'FundenFlo: new application {{ref}} for {{product}} is waiting on your lender portal.' },
  { key: NotificationTemplateKey.PayoutPaid, channel: NotificationChannel.email, locale: 'en', subject: 'Payout {{ref}} paid', body: 'FundenFlo paid {{amount}} for {{ref}} to your account ending {{account}} (UTR {{utr}}). TDS of {{tds}} was deducted and will appear in your Form 26AS.' },
  { key: NotificationTemplateKey.PayoutPaid, channel: NotificationChannel.sms, locale: 'en', subject: null, body: 'FundenFlo: payout {{ref}} of {{amount}} paid to a/c ending {{account}}, UTR {{utr}}.' },
  { key: NotificationTemplateKey.SubmissionStatusChanged, channel: NotificationChannel.push, locale: 'en', subject: 'Update on {{ref}}', body: 'Your application with {{lender}} is {{status}}.' },
  { key: NotificationTemplateKey.SubmissionStatusChanged, channel: NotificationChannel.sms, locale: 'en', subject: null, body: 'FundenFlo: your application {{ref}} with {{lender}} is {{status}}.' },
  { key: NotificationTemplateKey.DocumentRequested, channel: NotificationChannel.push, locale: 'en', subject: 'Documents needed for {{ref}}', body: 'Upload {{documents}} to keep your application moving.' },
  { key: NotificationTemplateKey.DocumentRequested, channel: NotificationChannel.sms, locale: 'en', subject: null, body: 'FundenFlo: please upload {{documents}} for application {{ref}} in the app.' },
];
