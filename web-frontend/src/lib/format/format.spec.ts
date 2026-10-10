import { describe, expect, it } from 'vitest';

import { formatDate, formatRelative } from './date';
import { attributeTitle, factInputOf, formatFactValue, formatKeyedFact, parseFactInput } from './fact';
import { formatFileSize, formatSizeLimit } from './file-size';
import { estimateEmiPaise, formatPaise, groupRupees, paiseFromRupees } from './money';

describe('money', () => {
  it('shows paise as rupees with Indian digit grouping', () => {
    expect(formatPaise(250_000_000)).toBe('₹25,00,000');
    expect(formatPaise(null)).toBe('—');
    expect(paiseFromRupees(1234.56)).toBe(123_456);
  });

  it('compacts large amounts', () => {
    expect(formatPaise(2_000_000_000, 'en', true)).toMatch(/₹2(\.0)?\s?Cr/);
  });

  it('groups rupees the Indian way', () => {
    expect(groupRupees(2_500_000)).toBe('25,00,000');
  });

  it('estimates a reducing-balance EMI', () => {
    expect(estimateEmiPaise(100_000_000, 1200, 12)).toBe(8_884_879);
    expect(estimateEmiPaise(120_000, 0, 12)).toBe(10_000);
    expect(estimateEmiPaise(0, 1500, 24)).toBe(0);
  });
});

describe('dates', () => {
  it('formats in India time', () => {
    expect(formatDate('2026-10-10T20:00:00.000Z')).toBe('11 Oct 2026');
  });

  it('describes time relative to now', () => {
    const now = Date.parse('2026-10-10T12:00:00.000Z');
    expect(formatRelative('2026-10-10T10:00:00.000Z', 'en', now)).toBe('2 hours ago');
    expect(formatRelative('2026-10-11T12:00:00.000Z', 'en', now)).toBe('tomorrow');
  });
});

describe('file size', () => {
  it('shows small files in KB and larger ones in MB', () => {
    expect(formatFileSize(300)).toBe('1 KB');
    expect(formatFileSize(512_000)).toBe('500 KB');
    expect(formatFileSize(3_250_000)).toBe('3.1 MB');
    expect(formatSizeLimit(10_485_760)).toBe('10 MB');
  });
});

describe('fact values', () => {
  const money = { dataType: 'money', enumValues: null };
  const yesNo = { yes: 'Yes', no: 'No' };
  it('shows money facts in rupees and ranges with a dash', () => {
    expect(formatFactValue(1_200_000_00, money, 'en', yesNo)).toBe('₹12,00,000');
    expect(formatFactValue({ min: 50_000_000, max: 249_999_999 }, money, 'en', yesNo)).toBe('₹5,00,000 – ₹25,00,000');
    expect(formatFactValue(true, { dataType: 'boolean', enumValues: null }, 'en', yesNo)).toBe('Yes');
  });

  it('turns typed input back into the stored value', () => {
    expect(parseFactInput('12,00,000', money)).toEqual({ ok: true, value: 1_200_000_00 });
    expect(parseFactInput('2.5', { dataType: 'integer' })).toEqual({ ok: false });
    expect(parseFactInput('true', { dataType: 'boolean' })).toEqual({ ok: true, value: true });
    expect(factInputOf(1_200_000_00, money)).toBe('1200000');
  });
});

describe('packet facts', () => {
  it('titles attribute keys and formats paise values as money', () => {
    expect(attributeTitle('business.monthly_turnover_paise')).toBe('Monthly Turnover');
    expect(attributeTitle('business.gst_registered')).toBe('Gst Registered');
    expect(formatKeyedFact('banking.avg_monthly_inflow_paise', 1_200_000_00, 'en', { yes: 'Yes', no: 'No' })).toBe('₹12,00,000');
    expect(formatKeyedFact('business.gst_registered', true, 'en', { yes: 'Yes', no: 'No' })).toBe('Yes');
  });
});
