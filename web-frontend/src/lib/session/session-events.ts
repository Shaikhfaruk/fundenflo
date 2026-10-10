import { SESSION_CHANNEL_NAME } from '@/lib/constants/session.constants';

export const SessionSignal = {
  Ended: 'ended',
  Changed: 'changed',
} as const;

export type SessionSignal = (typeof SessionSignal)[keyof typeof SessionSignal];

type Listener = (signal: SessionSignal) => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

const ensureChannel = () => {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
  channel.addEventListener('message', (event: MessageEvent<SessionSignal>) => listeners.forEach((listener) => listener(event.data)));
  return channel;
};

export function emitSession(signal: SessionSignal) {
  listeners.forEach((listener) => listener(signal));
  ensureChannel()?.postMessage(signal);
}

export function onSession(listener: Listener) {
  ensureChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
