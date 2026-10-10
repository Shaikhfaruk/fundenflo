'use client';

import { useEffect } from 'react';

import { useErrorToast } from '@/hooks/use-error-toast';
import { onMutationError } from '@/lib/api/mutation-errors';

export function MutationErrorToasts() {
  const toastError = useErrorToast();
  useEffect(() => onMutationError(toastError), [toastError]);
  return null;
}
