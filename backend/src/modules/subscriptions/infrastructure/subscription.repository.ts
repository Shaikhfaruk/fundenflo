import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { SubscriptionStatus } from '../../../common/enums/db.enums.js';
import type { NotificationChannel, Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class SubscriptionRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  upsert(data: { userId: string; event: string; entityType: string; entityId: string; channel: NotificationChannel }) {
    return this.txHost.tx.notificationSubscription.upsert({
      where: { userId_event_entityId_channel: { userId: data.userId, event: data.event, entityId: data.entityId, channel: data.channel } },
      create: data,
      update: { status: SubscriptionStatus.pending },
    });
  }

  pending(event: string, entityId: string, take: number) {
    return this.txHost.tx.notificationSubscription.findMany({ where: { event, entityId, status: SubscriptionStatus.pending }, orderBy: { createdAt: 'asc' }, take });
  }

  update(id: string, data: Prisma.NotificationSubscriptionUncheckedUpdateInput) {
    return this.txHost.tx.notificationSubscription.update({ where: { id }, data });
  }
}
