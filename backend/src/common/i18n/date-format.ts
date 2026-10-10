import { DISPLAY_TIME_ZONE, DISPLAY_UTC_OFFSET_MINUTES, MINUTE_MS } from '../constants/time.constants.js';
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

const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();

export function formatDisplayDate(date: Date, locale?: string | null): string {
  const resolved = locale ? resolveLocale(locale) : DEFAULT_LOCALE;
  let formatter = dateFormatters.get(resolved);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(`${resolved}-IN`, { timeZone: DISPLAY_TIME_ZONE, day: 'numeric', month: 'short' });
    dateFormatters.set(resolved, formatter);
  }
  return formatter.format(date);
}

const shift = (date: Date, minutes: number) => new Date(date.getTime() + minutes * MINUTE_MS);

export function startOfDisplayDay(date: Date): Date {
  const local = shift(date, DISPLAY_UTC_OFFSET_MINUTES);
  return shift(new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())), -DISPLAY_UTC_OFFSET_MINUTES);
}

export function startOfDisplayMonth(date: Date): Date {
  const local = shift(date, DISPLAY_UTC_OFFSET_MINUTES);
  return shift(new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)), -DISPLAY_UTC_OFFSET_MINUTES);
}
