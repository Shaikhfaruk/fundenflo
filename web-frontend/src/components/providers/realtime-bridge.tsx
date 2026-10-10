'use client';

import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';

import { syncChanges } from '@/lib/api/sync';
import { REFRESHABLE_ERRORS } from '@/lib/constants/errors.constants';
import { REALTIME_NAMESPACE, REALTIME_RECONNECT_DELAY_MS, RealtimeEvent, SYNC_CLOCK_SKEW_MS, SYNC_MAX_PAGES, SYNC_PAGE_LIMIT } from '@/lib/constants/realtime.constants';
import { keysForEvent, keysForSyncType } from '@/lib/realtime/realtime-routing';
import { refreshSession, socketToken } from '@/lib/session/client-session';
import { hasSession, sessionContext } from '@/lib/session/session-cookie';
import { onSession, SessionSignal } from '@/lib/session/session-events';

const freshToken = async () => {
  try {
    return (await socketToken()).token;
  } catch {
    if (!(await refreshSession(true))) throw new Error('session ended');
    return (await socketToken()).token;
  }
};

export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const t = useTranslations('realtime');
  useEffect(() => {
    let socket: Socket | null = null;
    let connectedContext: string | null = null;
    let lastSeen: number | null = null;
    let disposed = false;

    const invalidate = (keys: QueryKey[]) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };

    const catchUp = async (since: number) => {
      let cursor: string | undefined;
      for (let page = 0; page < SYNC_MAX_PAGES; page += 1) {
        const result = await syncChanges(cursor ? { since: cursor, limit: SYNC_PAGE_LIMIT } : { updatedSince: new Date(since - SYNC_CLOCK_SKEW_MS).toISOString(), limit: SYNC_PAGE_LIMIT });
        for (const type of new Set(result.items.map((change) => change.type))) invalidate(keysForSyncType(type));
        if (!result.hasMore || !result.nextCursor) return;
        cursor = result.nextCursor;
      }
    };

    const disconnect = () => {
      socket?.removeAllListeners();
      socket?.disconnect();
      socket = null;
      connectedContext = null;
    };

    const connect = async () => {
      if (disposed || socket || !hasSession()) return;
      const { origin } = await socketToken();
      if (disposed || socket) return;
      connectedContext = sessionContext();
      const client = io(`${origin}${REALTIME_NAMESPACE}`, {
        transports: ['websocket'],
        auth: (callback) => {
          void freshToken().then(
            (token) => callback({ token }),
            () => callback({}),
          );
        },
      });
      socket = client;
      client.on(RealtimeEvent.Ready, () => {
        if (lastSeen !== null) void catchUp(lastSeen).catch(() => undefined);
        lastSeen = Date.now();
      });
      client.on(RealtimeEvent.Error, (payload: { code?: string } | undefined) => {
        if (!payload?.code || !REFRESHABLE_ERRORS.includes(payload.code)) return;
        window.setTimeout(() => {
          if (socket === client && !disposed) client.connect();
        }, REALTIME_RECONNECT_DELAY_MS);
      });
      client.onAny((event: string, data: Record<string, unknown> | undefined) => {
        if (event === RealtimeEvent.Ready || event === RealtimeEvent.Error) return;
        lastSeen = Date.now();
        invalidate(keysForEvent(event, data));
        if (event === RealtimeEvent.FollowUpDue) toast.info(t('followUpDue'));
      });
    };

    const start = () => void connect().catch(() => undefined);
    start();
    const stop = onSession((signal) => {
      if (signal === SessionSignal.Ended) {
        disconnect();
        lastSeen = null;
        return;
      }
      if (socket && sessionContext() === connectedContext) return;
      disconnect();
      start();
    });
    return () => {
      disposed = true;
      stop();
      disconnect();
    };
  }, [queryClient, t]);
  return null;
}
