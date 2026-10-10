import { Inject } from '@nestjs/common';

export const PUSH_SENDER = Symbol('PUSH_SENDER');

export const InjectPushSender = () => Inject(PUSH_SENDER);

export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
};

export type PushResult = {
  provider: string;
  providerMessageId: string | null;
};

export class PushTokenRejectedError extends Error {}

export interface PushSender {
  send(message: PushMessage): Promise<PushResult>;
}
