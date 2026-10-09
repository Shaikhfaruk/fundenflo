import type { CountryCode, NumberType } from 'libphonenumber-js/max';

export const DEFAULT_COUNTRY: CountryCode = 'IN';

export const MOBILE_NUMBER_TYPES: ReadonlySet<NonNullable<NumberType>> = new Set(['MOBILE', 'FIXED_LINE_OR_MOBILE']);

export const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

export const MASK_CHARACTER = '•';

export const NAME_HONORIFICS: ReadonlySet<string> = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'sri', 'smt', 'kumari', 'km', 'ca', 'adv', 'er', 'prof']);

export const LANDLINE_NUMBER_TYPES: ReadonlySet<string> = new Set(['FIXED_LINE', 'FIXED_LINE_OR_MOBILE', 'VOIP', 'TOLL_FREE', 'UAN']);
