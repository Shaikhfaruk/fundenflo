import { z } from 'zod';

export const SUPPORTED_LOCALES = ['en', 'hi'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALISED_TEXT_MAX_LENGTH = 300;

export type LocalisedText = { en: string } & Partial<Record<Locale, string>>;

export const LOCALISED_LONG_TEXT_MAX_LENGTH = 5_000;

export const localisedTextSchemaOf = (maxLength: number) =>
  z
    .object({
      en: z.string().trim().min(1).max(maxLength),
      hi: z.string().trim().min(1).max(maxLength).optional(),
    })
    .strict();

export const localisedTextSchema = localisedTextSchemaOf(LOCALISED_TEXT_MAX_LENGTH);

export const localisedLongTextSchema = localisedTextSchemaOf(LOCALISED_LONG_TEXT_MAX_LENGTH);

const isLocale = (value: string): value is Locale => (SUPPORTED_LOCALES as readonly string[]).includes(value);

export function resolveLocale(...candidates: Array<string | undefined>): Locale {
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const part of candidate.split(',')) {
      const tag = part.split(';')[0]?.trim().toLowerCase().slice(0, 2) ?? '';
      if (isLocale(tag)) return tag;
    }
  }
  return DEFAULT_LOCALE;
}

export function localise(text: unknown, locale: Locale): string {
  if (!text || typeof text !== 'object') return '';
  const record = text as Partial<Record<Locale, unknown>>;
  const value = record[locale] ?? record[DEFAULT_LOCALE];
  return typeof value === 'string' ? value : '';
}
