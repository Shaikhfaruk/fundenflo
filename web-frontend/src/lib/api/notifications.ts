import { queryOptions } from '@tanstack/react-query';

import { apiRequest } from './client';

export type NotificationPreferences = { sms: boolean; email: boolean; push: boolean; version: number; updatedAt: string | null };

export const notificationKeys = { preferences: ['notification-preferences'] as const };

export const notificationPreferencesQuery = () => queryOptions({ queryKey: notificationKeys.preferences, queryFn: () => apiRequest<NotificationPreferences>('GET /me/notification-preferences') });

export const updateNotificationPreferences = (body: { sms: boolean; email: boolean; push: boolean }, version: number) => apiRequest<NotificationPreferences>('PUT /me/notification-preferences', { body, version });

export type SubscriptionInput = { event: string; entityId: string; channel: string };

export const subscribeToUpdates = (body: SubscriptionInput) => apiRequest<{ id: string; event: string; channel: string }>('POST /notifications/subscriptions', { body });
