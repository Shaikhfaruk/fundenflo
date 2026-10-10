import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import { DeliveryStatus, NotificationChannel } from '../../../common/enums/db.enums.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { type EmailSender, InjectEmailSender } from '../../../integrations/email/email.port.js';
import { InjectPushSender, type PushSender, PushTokenRejectedError } from '../../../integrations/push/push.port.js';
import { InjectSmsSender, type SmsSender } from '../../../integrations/sms/sms.port.js';
import type { DispatchJob, DispatchPayload } from '../application/notification.service.js';
import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { NOTIFICATION_DISPATCH_CONCURRENCY } from '../domain/notification.constants.js';
import { MissingTemplateParamsError, renderTemplate } from '../domain/template-renderer.js';

@Processor(QueueName.NotificationsDispatch, { concurrency: NOTIFICATION_DISPATCH_CONCURRENCY })
export class NotificationDispatchProcessor extends ContextualProcessor<DispatchJob> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly prisma: PrismaService,
    private readonly cipher: FieldCipher,
    @InjectSmsSender() private readonly sms: SmsSender,
    @InjectEmailSender() private readonly email: EmailSender,
    @InjectPushSender() private readonly push: PushSender,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DispatchJob>): Promise<void> {
    const delivery = await this.prisma.notificationDelivery.findUnique({ where: { id: job.data.deliveryId } });
    if (!delivery || delivery.status === DeliveryStatus.sent || delivery.status === DeliveryStatus.delivered) return;

    const templates = await this.prisma.notificationTemplate.findMany({
      where: { key: delivery.templateKey, channel: delivery.channel, active: true, locale: { in: [delivery.locale, DEFAULT_LOCALE] } },
    });
    const template = templates.find((item) => item.locale === delivery.locale) ?? templates.find((item) => item.locale === DEFAULT_LOCALE);
    if (!template) {
      await this.fail(delivery.id, `template ${delivery.templateKey}/${delivery.channel} is not configured`);
      return;
    }

    const payload = this.cipher.decryptJson<DispatchPayload>(job.data.payload, CipherPurpose.NotificationPayload);
    let body: string;
    let subject: string;
    try {
      body = renderTemplate(template.body, payload.params);
      subject = template.subject ? renderTemplate(template.subject, payload.params) : '';
    } catch (error) {
      if (error instanceof MissingTemplateParamsError) {
        await this.fail(delivery.id, error.message);
        return;
      }
      throw error;
    }

    try {
      const result = await this.deliver(delivery.channel, payload.recipient, subject, body, template.providerTemplateId);
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: DeliveryStatus.sent, provider: result.provider, providerMessageId: result.providerMessageId, sentAt: new Date(), error: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof PushTokenRejectedError) {
        await this.fail(delivery.id, message);
        return;
      }
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (finalAttempt) await this.fail(delivery.id, message);
      else await this.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { error: message } });
      throw error;
    }
  }

  private deliver(channel: NotificationChannel, recipient: string, subject: string, body: string, providerTemplateId: string | null) {
    if (channel === NotificationChannel.sms) return this.sms.send({ to: recipient, body, providerTemplateId });
    if (channel === NotificationChannel.push) return this.push.send({ to: recipient, title: subject, body });
    return this.email.send({ to: recipient, subject, text: body });
  }

  private async fail(deliveryId: string, reason: string) {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: DeliveryStatus.failed, error: reason, failedAt: new Date() },
    });
  }
}
