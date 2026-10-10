'use client';

import { useSyncExternalStore } from 'react';

import { sessionContext } from './session-cookie';

const subscribe = () => () => undefined;

export const useSessionContext = () => useSyncExternalStore(subscribe, sessionContext, () => null);
