import type { AppConfig } from '../../config/env.schema.js';
import { type PushMessage, type PushResult, type PushSender, PushTokenRejectedError } from './push.port.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const EXPO_TIMEOUT_MS = 10_000;

type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

export class ExpoPushSender implements PushSender {
  constructor(private readonly config: AppConfig) {}

  async send(message: PushMessage): Promise<PushResult> {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(this.config.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${this.config.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify({ to: message.to, title: message.title, body: message.body, sound: 'default' }),
      signal: AbortSignal.timeout(EXPO_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Expo push failed with HTTP ${response.status}`);
    const ticket = ((await response.json()) as { data: ExpoTicket }).data;
    if (ticket.status === 'ok') return { provider: 'expo', providerMessageId: ticket.id };
    if (ticket.details?.error === 'DeviceNotRegistered') throw new PushTokenRejectedError(ticket.message);
    throw new Error(`Expo push rejected: ${ticket.message}`);
  }
}
