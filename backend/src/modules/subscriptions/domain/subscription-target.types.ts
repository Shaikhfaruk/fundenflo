import type { AppAbility } from '../../access/domain/ability.types.js';
import type { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';

export type SubscriptionDelivery = { templateKey: NotificationTemplateKey; params: Record<string, string> };

export interface SubscriptionTarget {
  readonly entityType: string;
  readonly payloadKey: string;
  readonly oneShot: boolean;
  assertVisible(entityId: string, ability: AppAbility): Promise<void>;
  delivery(entityId: string, payload: Record<string, unknown>): Promise<SubscriptionDelivery | null>;
}
