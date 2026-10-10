'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useState } from 'react';

import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createQueryClient } from '@/lib/api/query-client';
import { MutationErrorToasts } from './mutation-error-toasts';
import { SessionWatcher } from './session-watcher';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SessionWatcher />
          <MutationErrorToasts />
          {children}
          <Toaster richColors closeButton position="top-center" />
          <ServiceWorkerRegister />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
