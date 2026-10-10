'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useRouter } from '@/i18n/navigation';
import { meKeys } from '@/lib/api/me';
import { AppPath, NEXT_PARAM, STAFF_SIGN_IN_AREAS } from '@/lib/constants/routes.constants';
import { onSession, SessionSignal } from '@/lib/session/session-events';

export function SessionWatcher() {
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(
    () =>
      onSession((signal) => {
        if (signal === SessionSignal.Changed) {
          void queryClient.invalidateQueries({ queryKey: meKeys.all });
          return;
        }
        queryClient.clear();
        const pathname = window.location.pathname;
        const staff = STAFF_SIGN_IN_AREAS.some((area) => pathname.includes(area));
        router.replace({ pathname: staff ? AppPath.StaffLogin : AppPath.Login, query: { [NEXT_PARAM]: `${pathname}${window.location.search}` } });
      }),
    [queryClient, router],
  );
  return null;
}
