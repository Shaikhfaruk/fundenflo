import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { InjectConfig } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import type { SendResult } from '../sms/sms.port.js';
import type { EmailMessage, EmailSender } from './email.port.js';

@Injectable()
export class SmtpEmailSender implements EmailSender, OnModuleDestroy {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(@InjectConfig() config: AppConfig) {
    this.transport = createTransport(config.SMTP_URL as string);
    this.from = config.EMAIL_FROM as string;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const info = await this.transport.sendMail({ from: this.from, to: message.to, subject: message.subject, text: message.text });
    return { provider: 'smtp', providerMessageId: info.messageId ?? null };
  }

  onModuleDestroy() {
    this.transport.close();
  }
}
