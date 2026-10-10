import { describe, expect, it } from 'vitest';

import { formatDate, formatRelative } from './date';
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
