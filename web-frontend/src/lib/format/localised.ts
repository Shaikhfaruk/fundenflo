import { DEFAULT_LOCALE } from '@/lib/constants/locale.constants';

export const pickText = (text: Record<string, string> | null | undefined, locale: string): string => (text ? (text[locale] ?? text[DEFAULT_LOCALE] ?? Object.values(text)[0] ?? '') : '');
