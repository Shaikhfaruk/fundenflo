import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export type ChannelChoices = { sms: boolean; email: boolean; push: boolean };

@Injectable()
export class NotificationPreferenceRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  find(userId: string) {
    return this.txHost.tx.notificationPreference.findUnique({ where: { userId } });
  }

  create(userId: string, choices: ChannelChoices) {
    return this.txHost.tx.notificationPreference.create({ data: { userId, ...choices } });
  }

  updateVersioned(userId: string, version: number, choices: ChannelChoices) {
    return this.txHost.tx.notificationPreference.updateMany({ where: { userId, version }, data: { ...choices, version: { increment: 1 } } });
  }

  delete(userId: string) {
    return this.txHost.tx.notificationPreference.deleteMany({ where: { userId } });
  }
}
