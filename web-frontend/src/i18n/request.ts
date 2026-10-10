import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';

import { DISPLAY_TIME_ZONE } from '@/lib/constants/locale.constants';
import { routing } from './routing';

export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootLocale());
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale: resolved,
    timeZone: DISPLAY_TIME_ZONE,
    messages: (await import(`../messages/${resolved}.json`)).default,
  };
});
