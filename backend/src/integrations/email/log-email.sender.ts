import { Injectable, Logger } from '@nestjs/common';

import { maskEmail } from '../../engines/party-matching/mask.js';
import type { SendResult } from '../sms/sms.port.js';
import type { EmailMessage, EmailSender } from './email.port.js';

@Injectable()
export class LogEmailSender implements EmailSender {
  private readonly logger = new Logger('EmailLogDriver');

  async send(message: EmailMessage): Promise<SendResult> {
    this.logger.log(`Email to ${maskEmail(message.to)} "${message.subject}": ${message.text}`);
    return { provider: 'log', providerMessageId: null };
  }
}
