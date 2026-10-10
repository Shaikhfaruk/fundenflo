import { Injectable, Logger } from '@nestjs/common';

import type { PushMessage, PushResult, PushSender } from './push.port.js';

@Injectable()
export class LogPushSender implements PushSender {
  private readonly logger = new Logger('PushLogDriver');

  async send(message: PushMessage): Promise<PushResult> {
    this.logger.log(`Push to ${message.to.slice(0, 18)}…: ${message.title} — ${message.body}`);
    return { provider: 'log', providerMessageId: null };
  }
}
