import { describe, expect, it } from 'vitest';

import { Msg91SmsSender } from './msg91-sms.sender.js';
import { MSG91_OTP_URL } from './sms.constants.js';
import { SmsTemplateUnsupportedError } from './sms.port.js';

const config = { SMS_API_KEY: 'msg91-test-key', MSG91_OTP_TEMPLATE_ID: '0123456789abcdef01234567' };

const fakeFetch = (status: number, reply: unknown) => {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const fetcher = (async (url: URL, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, fetcher };
};

const otpMessage = { to: '+919876543210', body: '482916 is your FundenFlo verification code.', providerTemplateId: null, otp: '482916' };

describe('MSG91 SMS sender', () => {
  it('sends our own code through the OTP API with the auth key header', async () => {
    const { calls, fetcher } = fakeFetch(200, { type: 'success', request_id: '3563716f4c4d353130393533' });
    await expect(new Msg91SmsSender(config, fetcher).send(otpMessage)).resolves.toEqual({ provider: 'msg91', providerMessageId: '3563716f4c4d353130393533' });
    const [call] = calls;
    expect(`${call?.url.origin}${call?.url.pathname}`).toBe(MSG91_OTP_URL);
    expect(Object.fromEntries(call?.url.searchParams ?? [])).toEqual({ template_id: config.MSG91_OTP_TEMPLATE_ID, mobile: '919876543210', otp: '482916', otp_length: '6' });
    expect(call?.init).toMatchObject({ method: 'POST', headers: { authkey: config.SMS_API_KEY } });
  });

  it('fails with the provider reason when MSG91 refuses', async () => {
    const { fetcher } = fakeFetch(200, { type: 'error', message: 'Invalid authkey' });
    await expect(new Msg91SmsSender(config, fetcher).send(otpMessage)).rejects.toThrow('MSG91 rejected the SMS (HTTP 200): Invalid authkey');
    const down = fakeFetch(502, {});
    await expect(new Msg91SmsSender(config, down.fetcher).send(otpMessage)).rejects.toThrow('HTTP 502');
  });

  it('refuses messages that are not one-time codes without calling MSG91', async () => {
    const { calls, fetcher } = fakeFetch(200, { type: 'success' });
    await expect(new Msg91SmsSender(config, fetcher).send({ ...otpMessage, otp: null })).rejects.toBeInstanceOf(SmsTemplateUnsupportedError);
    expect(calls).toHaveLength(0);
  });
});
