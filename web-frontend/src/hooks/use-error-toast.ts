'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { errorMessage, supportReference } from '@/lib/api/error-message';
import { ERROR_TOAST_DURATION_MS } from '@/lib/constants/motion.constants';

export function useErrorToast() {
  const t = useTranslations('errors');
  return useCallback(
    (error: unknown) => {
      const reference = supportReference(error);
      toast.error(errorMessage(error, t, (key) => t.has(key)), { duration: ERROR_TOAST_DURATION_MS, ...(reference ? { description: t('reference', { reference }) } : {}) });
    },
    [t],
  );
}

export function useErrorText() {
  const t = useTranslations('errors');
  return useCallback((error: unknown) => errorMessage(error, t, (key) => t.has(key)), [t]);
}
