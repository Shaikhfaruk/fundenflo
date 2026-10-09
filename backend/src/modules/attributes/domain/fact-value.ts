import { AttributeDataType } from '../../../common/enums/db.enums.js';
import type { AttributeSpec, FactValue } from '../../../engines/conditions/condition.types.js';
import { isRange } from '../../../engines/conditions/evaluate.js';
import { DATE_PATTERN, STRING_FACT_MAX_LENGTH } from './attribute.constants.js';

export type EnumOption = { value: string; label: { en: string; hi?: string } };

export type AttributeShape = {
  dataType: AttributeDataType;
  enumValues: EnumOption[] | null;
};

export type NormalisedFact =
  | { ok: true; value: FactValue; min: number | null; max: number | null }
  | { ok: false; message: string };

const NUMERIC: ReadonlySet<AttributeDataType> = new Set([AttributeDataType.integer, AttributeDataType.decimal, AttributeDataType.money, AttributeDataType.percentage]);

const isWhole = (value: number, dataType: AttributeDataType) =>
  dataType === AttributeDataType.integer || dataType === AttributeDataType.money ? Number.isSafeInteger(value) : Number.isFinite(value);

function numeric(raw: unknown, dataType: AttributeDataType): NormalisedFact {
  if (typeof raw === 'number') {
    if (!isWhole(raw, dataType)) return { ok: false, message: `must be ${dataType === AttributeDataType.decimal || dataType === AttributeDataType.percentage ? 'a number' : 'a whole number'}` };
    return { ok: true, value: raw, min: raw, max: raw };
  }
  if (isRange(raw)) {
    const { min, max } = raw;
    const valid = (bound: unknown) => bound === null || (typeof bound === 'number' && isWhole(bound, dataType));
    if (!valid(min) || !valid(max) || (min === null && max === null)) return { ok: false, message: 'range needs numeric min and/or max' };
    if (min !== null && max !== null && min > max) return { ok: false, message: 'range min must not exceed max' };
    return { ok: true, value: { min, max }, min, max };
  }
  return { ok: false, message: 'must be a number or a { min, max } range' };
}

export function normaliseFactValue(shape: AttributeShape, raw: unknown): NormalisedFact {
  if (raw === null || raw === undefined) return { ok: false, message: 'value is required' };
  if (NUMERIC.has(shape.dataType)) return numeric(raw, shape.dataType);
  switch (shape.dataType) {
    case AttributeDataType.boolean:
      return typeof raw === 'boolean' ? { ok: true, value: raw, min: null, max: null } : { ok: false, message: 'must be true or false' };
    case AttributeDataType.date:
      return typeof raw === 'string' && DATE_PATTERN.test(raw) && !Number.isNaN(Date.parse(raw))
        ? { ok: true, value: raw, min: null, max: null }
        : { ok: false, message: 'must be a date as YYYY-MM-DD' };
    case AttributeDataType.enum: {
      const allowed = new Set((shape.enumValues ?? []).map((option) => option.value));
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length === 0 || !values.every((value) => typeof value === 'string' && allowed.has(value))) {
        return { ok: false, message: `must be one of ${[...allowed].join(', ')}` };
      }
      return { ok: true, value: Array.isArray(raw) ? [...new Set(values as string[])] : (raw as string), min: null, max: null };
    }
    default:
      return typeof raw === 'string' && raw.trim().length > 0 && raw.length <= STRING_FACT_MAX_LENGTH
        ? { ok: true, value: raw.trim(), min: null, max: null }
        : { ok: false, message: `must be text up to ${STRING_FACT_MAX_LENGTH} characters` };
  }
}

export const toConditionSpec = (shape: AttributeShape): AttributeSpec => ({
  dataType: shape.dataType,
  ...(shape.enumValues ? { enumValues: shape.enumValues.map((option) => option.value) } : {}),
});
