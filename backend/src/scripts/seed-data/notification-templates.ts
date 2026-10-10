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
  [NotificationTemplateKey.LeadOffered]: 'SMS_DLT_TEMPLATE_LEAD_OFFERED',
  [NotificationTemplateKey.LeadOfferExpiring]: 'SMS_DLT_TEMPLATE_LEAD_OFFER_EXPIRING',
  [NotificationTemplateKey.LeadHandedOver]: 'SMS_DLT_TEMPLATE_LEAD_HANDED_OVER',
  [NotificationTemplateKey.LeadFirstContactDue]: 'SMS_DLT_TEMPLATE_LEAD_FIRST_CONTACT_DUE',
  [NotificationTemplateKey.FollowUpDue]: 'SMS_DLT_TEMPLATE_FOLLOW_UP_DUE',
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
];
