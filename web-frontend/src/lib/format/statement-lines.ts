import type { ReconciliationLine } from '@/lib/api/types/finance.types';
import { UTR_PATTERN } from '@/lib/constants/admin.constants';

import { paiseFromRupees } from './money';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type ParsedStatement = { lines: ReconciliationLine[]; bad: number[] };

export function parseStatementLines(text: string): ParsedStatement {
  const lines: ReconciliationLine[] = [];
  const bad: number[] = [];
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const [reference = '', amount = '', utr = '', paidOn = ''] = line.split(',').map((cell) => cell.trim());
      const rupees = Number(amount.replaceAll(/[₹\s]/g, ''));
      const valid = reference.length > 0 && rupees > 0 && (utr === '' || UTR_PATTERN.test(utr)) && (paidOn === '' || ISO_DAY.test(paidOn));
      if (!valid) {
        bad.push(index + 1);
        return;
      }
      lines.push({ reference, amountPaise: paiseFromRupees(rupees), ...(utr ? { utr } : {}), ...(paidOn ? { paidOn } : {}) });
    });
  return { lines, bad };
}
