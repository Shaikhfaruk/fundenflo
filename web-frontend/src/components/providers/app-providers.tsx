'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { MotionProvider } from '@/components/motion/motion-provider';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createQueryClient } from '@/lib/api/query-client';
import { MutationErrorToasts } from './mutation-error-toasts';
import { SessionWatcher } from './session-watcher';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <MotionProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SessionWatcher />
          <MutationErrorToasts />
          {children}
          <Toaster closeButton position="top-center" />
          <ServiceWorkerRegister />
        </TooltipProvider>
      </QueryClientProvider>
    </MotionProvider>
  );
}
