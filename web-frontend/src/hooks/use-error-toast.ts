'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { errorMessage, supportReference } from '@/lib/api/error-message';

export function useErrorToast() {
  const t = useTranslations('errors');
  return useCallback(
    (error: unknown) => {
      const reference = supportReference(error);
      toast.error(errorMessage(error, t, (key) => t.has(key)), reference ? { description: t('reference', { reference }) } : undefined);
    },
    [t],
  );
}

export function useErrorText() {
  const t = useTranslations('errors');
  return useCallback((error: unknown) => errorMessage(error, t, (key) => t.has(key)), [t]);
}
