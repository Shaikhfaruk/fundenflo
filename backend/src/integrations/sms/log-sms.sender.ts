import { Injectable, Logger } from '@nestjs/common';

import { maskMobile } from '../../engines/party-matching/mask.js';
import type { SendResult, SmsMessage, SmsSender } from './sms.port.js';

@Injectable()
export class LogSmsSender implements SmsSender {
  private readonly logger = new Logger('SmsLogDriver');

  async send(message: SmsMessage): Promise<SendResult> {
    this.logger.log(`SMS to ${maskMobile(message.to)}: ${message.body}`);
    return { provider: 'log', providerMessageId: null };
  }
}
