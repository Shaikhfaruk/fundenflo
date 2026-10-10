import { NotificationChannel } from '../../../common/enums/db.enums.js';

export const SubscriptionEvent = {
  AnalysisCompleted: 'analysis.completed',
  ApplicationStatusChanged: 'application.status_changed',
} as const;

export type SubscriptionEvent = (typeof SubscriptionEvent)[keyof typeof SubscriptionEvent];

export const SUBSCRIPTION_TARGET_METADATA = 'subscriptions:target';

export const SUBSCRIPTION_CHANNELS = [NotificationChannel.push, NotificationChannel.sms, NotificationChannel.whatsapp] as const;

export const DELIVERABLE_CHANNELS: ReadonlySet<string> = new Set([NotificationChannel.push, NotificationChannel.sms]);

export const SUBSCRIPTION_DELIVERY_BATCH = 200;
