import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';

import { DEFAULT_COUNTRY, EMAIL_PATTERN, LANDLINE_NUMBER_TYPES, MOBILE_NUMBER_TYPES } from './party-matching.constants.js';

export type NormalisedMobile = {
  e164: string;
  nationalNumber: string;
  countryCallingCode: string;
};

export function normaliseMobile(input: string, countryCode?: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): NormalisedMobile | null {
  const compact = input.replace(/[\s().-]/g, '');
  if (compact.length === 0) return null;
  const prefix = countryCode?.replace(/[\s()-]/g, '');
  const candidate = prefix && !compact.startsWith('+') ? `${prefix.startsWith('+') ? prefix : `+${prefix}`}${compact}` : compact;
  const parsed = parsePhoneNumberFromString(candidate, defaultCountry);
  if (!parsed?.isValid()) return null;
  const type = parsed.getType();
  if (!type || !MOBILE_NUMBER_TYPES.has(type)) return null;
  return {
    e164: parsed.number,
    nationalNumber: parsed.nationalNumber,
    countryCallingCode: parsed.countryCallingCode,
  };
}

export function normaliseLandline(input: string, countryCode?: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string | null {
  const compact = input.replace(/[\s().-]/g, '');
  if (compact.length === 0) return null;
  const prefix = countryCode?.replace(/[\s()-]/g, '');
  const candidate = prefix && !compact.startsWith('+') ? `${prefix.startsWith('+') ? prefix : `+${prefix}`}${compact}` : compact;
  const parsed = parsePhoneNumberFromString(candidate, defaultCountry);
  const type = parsed?.getType();
  return parsed?.isValid() && type && LANDLINE_NUMBER_TYPES.has(type) ? parsed.number : null;
}

export function normaliseEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  return EMAIL_PATTERN.test(value) ? value : null;
}
