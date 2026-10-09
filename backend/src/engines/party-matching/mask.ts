import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

import { MASK_CHARACTER } from './party-matching.constants.js';

export function maskMobile(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  const national = parsed?.nationalNumber ?? e164.replace(/\D/g, '');
  const hidden = MASK_CHARACTER.repeat(Math.max(0, national.length - 5));
  const masked = `${national.slice(0, 2)}${hidden}${national.slice(-3)}`;
  return parsed ? `+${parsed.countryCallingCode} ${masked}` : masked;
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return MASK_CHARACTER.repeat(3);
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}${MASK_CHARACTER.repeat(3)}${email.slice(at)}`;
}
