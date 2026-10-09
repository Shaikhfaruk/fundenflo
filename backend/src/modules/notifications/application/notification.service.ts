import { Injectable } from '@nestjs/common';

import { NotificationChannel } from '../../../common/enums/db.enums.js';
import { maskEmail, maskMobile } from '../../../engines/party-matching/mask.js';
import { BlindIndex } from '../../../infrastructure/crypto/blind-index.service.js';
import { BlindIndexDomain, CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { JobPriority } from '../../../infrastructure/queue/queue.constants.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { QueueRegistry } from '../../../infrastructure/queue/queue-registry.service.js';
import { DEFAULT_LOCALE, type NotificationTemplateKey } from '../domain/notification.constants.js';
import type { TemplateParams } from '../domain/template-renderer.js';

export type NotificationRequest = {
  templateKey: NotificationTemplateKey;
  channel: typeof NotificationChannel.sms | typeof NotificationChannel.email;
  recipient: string;
  params: TemplateParams;
  locale?: string;
  priority?: number;
};

export type DispatchJob = {
  deliveryId: string;
  payload: string;
};

export type DispatchPayload = {
  recipient: string;
  params: TemplateParams;
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueRegistry,
    private readonly cipher: FieldCipher,
    private readonly blindIndex: BlindIndex,
  ) {}

  async send(request: NotificationRequest): Promise<{ deliveryId: string }> {
    const isSms = request.channel === NotificationChannel.sms;
    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        templateKey: request.templateKey,
        channel: request.channel,
        locale: request.locale ?? DEFAULT_LOCALE,
        recipientHash: this.blindIndex.hash(isSms ? BlindIndexDomain.Mobile : BlindIndexDomain.Email, request.recipient),
        recipientMasked: isSms ? maskMobile(request.recipient) : maskEmail(request.recipient),
      },
    });
    const payload: DispatchPayload = { recipient: request.recipient, params: request.params };
    const job: DispatchJob = { deliveryId: delivery.id, payload: this.cipher.encryptJson(payload, CipherPurpose.NotificationPayload) };
    await this.queues
      .get(QueueName.NotificationsDispatch)
      .add(request.templateKey, job, { jobId: delivery.id, priority: request.priority ?? JobPriority.Normal });
    return { deliveryId: delivery.id };
  }
}
