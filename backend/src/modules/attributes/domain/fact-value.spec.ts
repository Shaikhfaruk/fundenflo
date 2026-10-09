import { describe, expect, it } from 'vitest';

import { AttributeDataType } from '../../../common/enums/db.enums.js';
import { normaliseFactValue } from './fact-value.js';

const money = { dataType: AttributeDataType.money, enumValues: null };
const employment = {
  dataType: AttributeDataType.enum,
  enumValues: [
    { value: 'salaried', label: { en: 'Salaried' } },
    { value: 'self_employed', label: { en: 'Self-Employed' } },
  ],
};

describe('normaliseFactValue', () => {
  it('accepts whole-number money and ranges', () => {
    expect(normaliseFactValue(money, 250_000_000)).toEqual({ ok: true, value: 250_000_000, min: 250_000_000, max: 250_000_000 });
    expect(normaliseFactValue(money, { min: 50_000_000, max: null })).toEqual({ ok: true, value: { min: 50_000_000, max: null }, min: 50_000_000, max: null });
  });

  it('rejects fractional money, inverted ranges and empty ranges', () => {
    expect(normaliseFactValue(money, 10.5).ok).toBe(false);
    expect(normaliseFactValue(money, { min: 10, max: 5 }).ok).toBe(false);
    expect(normaliseFactValue(money, { min: null, max: null }).ok).toBe(false);
  });

  it('checks enum values, single or multiple', () => {
    expect(normaliseFactValue(employment, 'salaried')).toMatchObject({ ok: true, value: 'salaried' });
    expect(normaliseFactValue(employment, ['salaried', 'salaried'])).toMatchObject({ ok: true, value: ['salaried'] });
    expect(normaliseFactValue(employment, 'retired').ok).toBe(false);
  });

  it('checks booleans, dates and text', () => {
    expect(normaliseFactValue({ dataType: AttributeDataType.boolean, enumValues: null }, 'yes').ok).toBe(false);
    expect(normaliseFactValue({ dataType: AttributeDataType.date, enumValues: null }, '2026-13-40').ok).toBe(false);
    expect(normaliseFactValue({ dataType: AttributeDataType.string, enumValues: null }, '  Sharma Autocraft ')).toMatchObject({ ok: true, value: 'Sharma Autocraft' });
  });
});
