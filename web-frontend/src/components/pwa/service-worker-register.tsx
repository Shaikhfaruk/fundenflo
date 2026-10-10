'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { SERVICE_WORKER_URL, SwMessage } from '@/lib/constants/pwa.constants';

export function ServiceWorkerRegister() {
  const t = useTranslations('pwa');
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return undefined;
    let reloading = false;
    let controller = navigator.serviceWorker.controller;
    const onControllerChange = () => {
      const replaced = controller !== null;
      controller = navigator.serviceWorker.controller;
      if (reloading || !replaced) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    const offerUpdate = (worker: ServiceWorker) =>
      toast(t('updateReady'), { duration: Number.POSITIVE_INFINITY, action: { label: t('updateNow'), onClick: () => worker.postMessage({ type: SwMessage.SkipWaiting }) } });
    void navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' }).then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(installing);
        });
      });
    });
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, [t]);
  return null;
}
