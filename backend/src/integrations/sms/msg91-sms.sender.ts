import type { AppConfig } from '../../config/env.schema.js';
import { MSG91_FLOW_URL, MSG91_PROVIDER, MSG91_SUCCESS, MSG91_TIMEOUT_MS } from './sms.constants.js';
import { type SendResult, type SmsMessage, type SmsSender, SmsTemplateUnsupportedError } from './sms.port.js';

type Msg91Reply = { type?: string; request_id?: string; message?: string };

export class Msg91SmsSender implements SmsSender {
  constructor(
    private readonly config: Pick<AppConfig, 'SMS_API_KEY' | 'MSG91_OTP_TEMPLATE_ID'>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async send(message: SmsMessage): Promise<SendResult> {
    if (!message.otp) throw new SmsTemplateUnsupportedError('MSG91 is set up for one-time codes only; this message has no MSG91 template');
    const url = new URL(MSG91_FLOW_URL);
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: { authkey: this.config.SMS_API_KEY as string, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        template_id: this.config.MSG91_OTP_TEMPLATE_ID,
        recipients: [{ mobiles: message.to.replace(/^\+/, ''), OTP: message.otp }],
      }),
      signal: AbortSignal.timeout(MSG91_TIMEOUT_MS),
    });
    const reply = (await response.json().catch(() => null)) as Msg91Reply | null;
    if (!response.ok || reply?.type !== MSG91_SUCCESS) throw new Error(`MSG91 rejected the SMS (HTTP ${response.status}): ${reply?.message ?? 'no reply'}`);
    return { provider: MSG91_PROVIDER, providerMessageId: reply.request_id ?? null };
  }
}
