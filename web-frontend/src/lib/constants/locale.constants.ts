import { TRANSLATED_LOCALES } from '@/messages/available-locales';

export const DEFAULT_LOCALE = 'en' as const;

export const LOCALE_COOKIE = 'ff_locale';

export const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export const LOCALES = [DEFAULT_LOCALE, ...TRANSLATED_LOCALES] as const;

export const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  mr: 'मराठी',
  gu: 'ગુજરાતી',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  kn: 'ಕನ್ನಡ',
  ml: 'മലയാളം',
  pa: 'ਪੰਜਾਬੀ',
  or: 'ଓଡ଼ିଆ',
};

export const BACKEND_LOCALES: readonly string[] = ['en', 'hi'];

export const DISPLAY_TIME_ZONE = 'Asia/Kolkata';

export const CURRENCY = 'INR';

export const HERO_LOCALES = [
  { code: 'en', short: 'EN', name: 'English' },
  { code: 'hi', short: 'हिं', name: 'हिन्दी' },
] as const;
