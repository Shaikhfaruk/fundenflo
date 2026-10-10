import type { AttributeSpec, FactValue } from './condition.types.js';

const NUMERIC: ReadonlySet<AttributeSpec['dataType']> = new Set(['integer', 'decimal', 'money', 'percentage']);

export function coerceFactText(spec: AttributeSpec, raw: string): FactValue | undefined {
  const text = raw.trim();
  if (spec.dataType === 'boolean') return text === 'true' ? true : text === 'false' ? false : undefined;
  if (NUMERIC.has(spec.dataType)) {
    const value = Number(text);
    return text !== '' && Number.isFinite(value) ? value : undefined;
  }
  if (spec.dataType === 'enum') return spec.enumValues?.includes(text) ? text : undefined;
  return text;
}
