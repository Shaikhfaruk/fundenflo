import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { PrismaTx } from './database.types.js';

export const RefKind = {
  Lead: { prefix: 'LD', sequence: 'lead_ref_seq' },
} as const;

export type RefKind = (typeof RefKind)[keyof typeof RefKind];

export const REF_DIGITS = 6;

@Injectable()
export class RefGenerator {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  async next(kind: RefKind, now = new Date()): Promise<string> {
    const [row] = await this.txHost.tx.$queryRawUnsafe<Array<{ value: bigint }>>(`SELECT nextval('${kind.sequence}') AS value`);
    if (!row) throw new Error(`Sequence ${kind.sequence} returned no value`);
    const year = String(now.getUTCFullYear()).slice(-2);
    return `${kind.prefix}-${year}-${String(row.value).padStart(REF_DIGITS, '0')}`;
  }
}
