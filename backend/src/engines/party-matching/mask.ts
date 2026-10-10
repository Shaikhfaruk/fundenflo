import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

import { MASK_CHARACTER, NAME_HONORIFICS } from './party-matching.constants.js';

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

export function maskName(name: string): string {
  const tokens = name.trim().split(/\s+/).filter((token) => token.length > 0 && !NAME_HONORIFICS.has(token.toLowerCase().replace(/\.$/, '')));
  const [first, ...rest] = tokens;
  if (!first) return '';
  if (rest.length === 0) return `${first.slice(0, 1)}${MASK_CHARACTER.repeat(3)}`;
  return [first, ...rest.map((token) => `${token.slice(0, 1).toUpperCase()}.`)].join(' ');
}

export function maskIdentifier(value: string): string {
  if (value.length <= 6) return MASK_CHARACTER.repeat(value.length);
  return `${value.slice(0, 5)}${MASK_CHARACTER.repeat(value.length - 6)}${value.slice(-1)}`;
}
