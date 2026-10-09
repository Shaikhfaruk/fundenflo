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
];
