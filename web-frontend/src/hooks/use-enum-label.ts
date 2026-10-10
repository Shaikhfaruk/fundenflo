'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

const humanise = (value: string) => value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());

export function useEnumLabel(group: string) {
  const t = useTranslations(`enums.${group}`);
  return useCallback((value: string | null | undefined) => (value ? (t.has(value) ? t(value) : humanise(value)) : '—'), [t]);
}

export function useEnumLabels() {
  const t = useTranslations('enums');
  return useCallback((group: string | undefined, value: string | null | undefined) => (value ? (group && t.has(`${group}.${value}`) ? t(`${group}.${value}`) : humanise(value)) : '—'), [t]);
}
