import { Inject } from '@nestjs/common';

import type { SendResult } from '../sms/sms.port.js';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export const InjectEmailSender = () => Inject(EMAIL_SENDER);

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<SendResult>;
}
