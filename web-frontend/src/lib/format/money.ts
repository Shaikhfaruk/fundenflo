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

const BPS_PER_UNIT = 10_000;
const MONTHS_PER_YEAR = 12;

const grouping = new Intl.NumberFormat(INDIAN_LOCALE, { maximumFractionDigits: 0 });

export const groupRupees = (rupees: number) => grouping.format(rupees);

export const rupeesFromPaiseValue = (paise: number) => Math.round(rupeesFromPaise(paise));

export function estimateEmiPaise(principalPaise: number, annualRateBps: number, months: number): number {
  if (principalPaise <= 0 || months <= 0) return 0;
  const monthlyRate = annualRateBps / BPS_PER_UNIT / MONTHS_PER_YEAR;
  if (monthlyRate === 0) return Math.round(principalPaise / months);
  const growth = (1 + monthlyRate) ** months;
  return Math.round((principalPaise * monthlyRate * growth) / (growth - 1));
}
