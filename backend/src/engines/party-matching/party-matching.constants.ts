import type { CountryCode, NumberType } from 'libphonenumber-js/max';

export const DEFAULT_COUNTRY: CountryCode = 'IN';

export const MOBILE_NUMBER_TYPES: ReadonlySet<NonNullable<NumberType>> = new Set(['MOBILE', 'FIXED_LINE_OR_MOBILE']);

export const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

export const MASK_CHARACTER = '•';
