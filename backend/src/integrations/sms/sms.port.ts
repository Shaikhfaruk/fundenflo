import { Inject } from '@nestjs/common';

export const SMS_SENDER = Symbol('SMS_SENDER');

export const InjectSmsSender = () => Inject(SMS_SENDER);

export type SmsMessage = {
  to: string;
  body: string;
  providerTemplateId: string | null;
};

export type SendResult = {
  provider: string;
  providerMessageId: string | null;
};

export interface SmsSender {
  send(message: SmsMessage): Promise<SendResult>;
}
