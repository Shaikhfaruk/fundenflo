'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

const onServer = () => null;

export function useClientValue<T>(read: () => T): T | null {
  return useSyncExternalStore(subscribe, read, onServer);
}
