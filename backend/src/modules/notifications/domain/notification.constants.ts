export const NotificationTemplateKey = {
  AuthOtp: 'auth.otp',
  InvitationStaff: 'invitation.staff',
  InvitationMember: 'invitation.member',
  ConsentRequest: 'consent.request',
} as const;

export type NotificationTemplateKey = (typeof NotificationTemplateKey)[keyof typeof NotificationTemplateKey];

export const TEMPLATE_PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export const NOTIFICATION_DISPATCH_CONCURRENCY = 10;
