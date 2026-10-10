import { CURRENCY } from '@/lib/constants/locale.constants';

const PAISE_PER_RUPEE = 100;
const INDIAN_LOCALE = 'en-IN';

const formatters = new Map<string, Intl.NumberFormat>();

const formatter = (locale: string, compact: boolean) => {
  const key = `${locale}:${compact}`;
  let value = formatters.get(key);
  if (!value) {
    value = new Intl.NumberFormat(locale === 'en' ? INDIAN_LOCALE : `${locale}-IN`, { style: 'currency', currency: CURRENCY, maximumFractionDigits: compact ? 1 : 0, notation: compact ? 'compact' : 'standard' });
    formatters.set(key, value);
  }
  return value;
};

const rupeesFromPaise = (paise: number) => paise / PAISE_PER_RUPEE;

export const paiseFromRupees = (rupees: number) => Math.round(rupees * PAISE_PER_RUPEE);

export function formatPaise(paise: number | null | undefined, locale = 'en', compact = false): string {
  if (paise === null || paise === undefined) return '—';
  return formatter(locale, compact).format(rupeesFromPaise(paise));
}
