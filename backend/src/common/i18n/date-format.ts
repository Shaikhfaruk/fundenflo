import { DISPLAY_TIME_ZONE } from '../constants/time.constants.js';
import { DEFAULT_LOCALE, type Locale, resolveLocale } from './locale.js';

const formatters = new Map<Locale, Intl.DateTimeFormat>();

export function formatDisplayDateTime(date: Date, locale?: string | null): string {
  const resolved = locale ? resolveLocale(locale) : DEFAULT_LOCALE;
  let formatter = formatters.get(resolved);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(`${resolved}-IN`, { timeZone: DISPLAY_TIME_ZONE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    formatters.set(resolved, formatter);
  }
  return formatter.format(date);
}
