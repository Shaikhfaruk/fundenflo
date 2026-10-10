import { paiseFromRupees, formatPaise, rupeesFromPaiseValue } from './money';
import { formatDate } from './date';
import { pickText } from './localised';
import type { AttributeDefinition } from '@/lib/api/types/admin.types';

export const AttributeDataType = {
  Integer: 'integer',
  Decimal: 'decimal',
  Money: 'money',
  Boolean: 'boolean',
  Enum: 'enum',
  String: 'string',
  Date: 'date',
  Percentage: 'percentage',
} as const;

const NUMERIC: readonly string[] = [AttributeDataType.Integer, AttributeDataType.Decimal, AttributeDataType.Percentage];

type Range = { min?: number; max?: number };

export const textOf = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return JSON.stringify(value);
};

const isRange = (value: unknown): value is Range => typeof value === 'object' && value !== null && ('min' in value || 'max' in value);

export function formatFactValue(value: unknown, attribute: Pick<AttributeDefinition, 'dataType' | 'enumValues'> | undefined, locale: string, yesNo: { yes: string; no: string }): string {
  if (value === null || value === undefined) return '—';
  const one = (item: unknown): string => {
    if (attribute?.dataType === AttributeDataType.Money && typeof item === 'number') return formatPaise(item, locale);
    if (attribute?.dataType === AttributeDataType.Percentage && typeof item === 'number') return `${item}%`;
    if (attribute?.dataType === AttributeDataType.Date && typeof item === 'string') return formatDate(item, locale);
    if (typeof item === 'boolean') return item ? yesNo.yes : yesNo.no;
    if (attribute?.dataType === AttributeDataType.Enum && typeof item === 'string') return pickText(attribute.enumValues?.find((option) => option.value === item)?.label, locale) || item;
    return textOf(item);
  };
  if (isRange(value)) return [value.min, value.max].filter((item) => item !== undefined).map(one).join(' – ');
  return one(value);
}

export function factInputOf(value: unknown, attribute: Pick<AttributeDefinition, 'dataType'> | undefined): string {
  if (value === null || value === undefined || isRange(value)) return '';
  if (attribute?.dataType === AttributeDataType.Money && typeof value === 'number') return String(rupeesFromPaiseValue(value));
  return textOf(value);
}

export function parseFactInput(raw: string, attribute: Pick<AttributeDefinition, 'dataType'> | undefined): { ok: true; value: unknown } | { ok: false } {
  const text = raw.trim();
  if (!text) return { ok: false };
  const type = attribute?.dataType ?? AttributeDataType.String;
  if (type === AttributeDataType.Money) {
    const rupees = Number(text.replaceAll(',', ''));
    return Number.isFinite(rupees) && rupees >= 0 ? { ok: true, value: paiseFromRupees(rupees) } : { ok: false };
  }
  if (NUMERIC.includes(type)) {
    const number = Number(text.replaceAll(',', ''));
    if (!Number.isFinite(number) || (type === AttributeDataType.Integer && !Number.isInteger(number))) return { ok: false };
    return { ok: true, value: number };
  }
  if (type === AttributeDataType.Boolean) return text === 'true' || text === 'false' ? { ok: true, value: text === 'true' } : { ok: false };
  return { ok: true, value: text };
}
