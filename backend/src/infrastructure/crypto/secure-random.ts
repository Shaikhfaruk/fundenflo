import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export const randomDigits = (length: number): string =>
  Array.from({ length }, () => randomInt(0, 10).toString()).join('');

export const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('base64url');

export const hmacSha256 = (key: Buffer, value: string): string =>
  createHmac('sha256', key).update(value, 'utf8').digest('base64url');

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
