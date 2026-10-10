'use client';

import { useEffect } from 'react';

import { setPushToken } from '@/lib/api/me';
import { EXPO_PUSH_TOKEN_PATTERN, NativeBridgeMessage } from '@/lib/constants/realtime.constants';
import { hasSession } from '@/lib/session/session-cookie';
import { onSession, SessionSignal } from '@/lib/session/session-events';

type NativeWebView = { postMessage: (message: string) => void };

const nativeWebView = (): NativeWebView | null => (window as Window & { ReactNativeWebView?: NativeWebView }).ReactNativeWebView ?? null;

const parse = (raw: unknown): { type?: unknown; token?: unknown } | null => {
  if (typeof raw !== 'string') return typeof raw === 'object' && raw !== null ? raw : null;
  try {
    return JSON.parse(raw) as { type?: unknown; token?: unknown };
  } catch {
    return null;
  }
};

export function NativePushBridge() {
  useEffect(() => {
    const webview = nativeWebView();
    if (!webview) return undefined;
    let sentToken: string | null = null;
    const request = () => {
      if (hasSession()) webview.postMessage(JSON.stringify({ type: NativeBridgeMessage.RequestPushToken }));
    };
    const onMessage = (event: Event) => {
      const message = parse((event as MessageEvent).data);
      if (message?.type !== NativeBridgeMessage.PushToken || typeof message.token !== 'string' || !EXPO_PUSH_TOKEN_PATTERN.test(message.token)) return;
      if (message.token === sentToken || !hasSession()) return;
      sentToken = message.token;
      void setPushToken(message.token).catch(() => {
        sentToken = null;
      });
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('message', onMessage);
    request();
    const stop = onSession((signal) => {
      if (signal === SessionSignal.Ended) {
        sentToken = null;
        return;
      }
      sentToken = null;
      request();
    });
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('message', onMessage);
      stop();
    };
  }, []);
  return null;
}
