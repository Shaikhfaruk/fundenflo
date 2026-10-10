import { describe, expect, it } from 'vitest';

import { parseStatementLines } from './statement-lines';

describe('parseStatementLines', () => {
  it('reads reference, rupee amount, UTR and date per line', () => {
    expect(parseStatementLines('RC-26-000008, 11800, NEFT1791661445, 2026-10-10\nRC-26-000009, ₹ 2500.50')).toEqual({
      lines: [
        { reference: 'RC-26-000008', amountPaise: 1_180_000, utr: 'NEFT1791661445', paidOn: '2026-10-10' },
        { reference: 'RC-26-000009', amountPaise: 250_050 },
      ],
      bad: [],
    });
  });

  it('reports the line numbers it cannot read and skips blank lines', () => {
    expect(parseStatementLines('\nRC-1, 0\n, 100\nRC-2, 100, bad utr!\nRC-3, 100, NEFT123456, 10/10/2026\nRC-4, 100').bad).toEqual([1, 2, 3, 4]);
  });
});
