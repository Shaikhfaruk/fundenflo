import { Injectable } from '@nestjs/common';

import { NotificationChannel, SubscriptionStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { NotificationSubscription } from '../../../generated/prisma/client.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { type UserChannel, UserNotifier } from '../../auth/application/user-notifier.service.js';
import { DELIVERABLE_CHANNELS, SUBSCRIPTION_DELIVERY_BATCH, type SubscriptionEvent } from '../domain/subscription.constants.js';
import { SubscriptionRepository } from '../infrastructure/subscription.repository.js';
import { SubscriptionTargetRegistry } from './subscription-target.registry.js';

export type SubscriptionInput = { event: SubscriptionEvent; entityId: string; channel: NotificationChannel };

const CHANNELS: Partial<Record<NotificationChannel, readonly UserChannel[]>> = {
  [NotificationChannel.push]: [NotificationChannel.push, NotificationChannel.sms],
  [NotificationChannel.sms]: [NotificationChannel.sms],
};

const toView = (subscription: NotificationSubscription) => ({
  id: subscription.id,
  event: subscription.event,
  entityType: subscription.entityType,
  entityId: subscription.entityId,
  channel: subscription.channel,
  status: subscription.status,
  sentAt: subscription.sentAt?.toISOString() ?? null,
  createdAt: subscription.createdAt.toISOString(),
});

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly targets: SubscriptionTargetRegistry,
    private readonly notifier: UserNotifier,
  ) {}

  async subscribe(userId: string, input: SubscriptionInput, ability: AppAbility) {
    if (!DELIVERABLE_CHANNELS.has(input.channel)) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'channel', code: 'channel_unavailable', message: `${input.channel} updates are not available yet; use push or sms` }] });
    const target = this.targets.get(input.event);
    if (!target) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'event', code: 'unknown_event', message: `cannot subscribe to ${input.event}` }] });
    await target.assertVisible(input.entityId, ability);
    return toView(await this.subscriptions.upsert({ userId, event: input.event, entityType: target.entityType, entityId: input.entityId, channel: input.channel }));
  }

  async deliver(event: SubscriptionEvent, payload: Record<string, unknown>): Promise<number> {
    const target = this.targets.get(event);
    const entityId = target ? payload[target.payloadKey] : undefined;
    if (!target || typeof entityId !== 'string') return 0;
    const pending = await this.subscriptions.pending(event, entityId, SUBSCRIPTION_DELIVERY_BATCH);
    if (pending.length === 0) return 0;
    const delivery = await target.delivery(entityId, payload);
    if (!delivery) return 0;
    let sent = 0;
    for (const subscription of pending) {
      sent += await this.notifier.notify([subscription.userId], delivery.templateKey, () => delivery.params, CHANNELS[subscription.channel] ?? []);
      await this.subscriptions.update(subscription.id, { sentAt: new Date(), ...(target.oneShot ? { status: SubscriptionStatus.sent } : {}) });
    }
    return sent;
  }
}
