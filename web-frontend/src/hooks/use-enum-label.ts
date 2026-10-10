'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

const humanise = (value: string) => value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());

export function useEnumLabel(group: string) {
  const t = useTranslations(`enums.${group}`);
  return useCallback((value: string | null | undefined) => (value ? (t.has(value) ? t(value) : humanise(value)) : '—'), [t]);
}
