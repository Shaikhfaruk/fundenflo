import { DISPLAY_TIME_ZONE } from '@/lib/constants/locale.constants';

const cache = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (locale: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${locale}:${JSON.stringify(options)}`;
  let value = cache.get(key);
  if (!value) {
    value = new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : `${locale}-IN`, { timeZone: DISPLAY_TIME_ZONE, ...options });
    cache.set(key, value);
  }
  return value;
};

export const formatDate = (iso: string | null | undefined, locale = 'en') => (iso ? formatterFor(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—');

export const formatDateTime = (iso: string | null | undefined, locale = 'en') => (iso ? formatterFor(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '—');

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelative(iso: string | null | undefined, locale = 'en', now = Date.now()): string {
  if (!iso) return '—';
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return format.format(seconds, 'second');
}

export const todayIsoDate = () => new Date().toISOString().slice(0, 10);
