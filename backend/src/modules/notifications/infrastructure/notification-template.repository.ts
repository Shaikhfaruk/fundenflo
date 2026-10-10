import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { NotificationChannel } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class NotificationTemplateRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  list(where: Prisma.NotificationTemplateWhereInput) {
    return this.txHost.tx.notificationTemplate.findMany({ where, orderBy: [{ key: 'asc' }, { channel: 'asc' }, { locale: 'asc' }] });
  }

  find(id: string) {
    return this.txHost.tx.notificationTemplate.findUnique({ where: { id } });
  }

  findVariant(key: string, channel: NotificationChannel, locale: string) {
    return this.txHost.tx.notificationTemplate.findUnique({ where: { key_channel_locale: { key, channel, locale } } });
  }

  create(data: Prisma.NotificationTemplateCreateInput) {
    return this.txHost.tx.notificationTemplate.create({ data });
  }

  updateVersioned(id: string, version: number, data: Prisma.NotificationTemplateUpdateManyMutationInput) {
    return this.txHost.tx.notificationTemplate.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }
}
