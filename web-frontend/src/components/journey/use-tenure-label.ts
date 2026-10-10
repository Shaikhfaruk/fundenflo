'use client';

import { useTranslations } from 'next-intl';

import { MONTHS_PER_YEAR } from '@/lib/constants/journey.constants';

export function useTenureLabel() {
  const t = useTranslations('flow.requirement');
  return (months: number) => (months % MONTHS_PER_YEAR === 0 ? t('years', { count: months / MONTHS_PER_YEAR }) : t('months', { count: months }));
}
