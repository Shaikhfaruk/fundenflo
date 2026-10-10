import { Injectable } from '@nestjs/common';

import { RequestContext } from '../../../common/context/request-context.service.js';
import type { JournalKind } from '../../../common/enums/db.enums.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import type { LedgerAccountSpec } from '../domain/commission.constants.js';
import { LedgerRepository } from '../infrastructure/ledger.repository.js';

export type LedgerLine = { account: LedgerAccountSpec; debit?: bigint; credit?: bigint };

export type JournalInput = { kind: JournalKind; sourceType: string; sourceId: string; memo: string; lines: LedgerLine[] };

@Injectable()
export class LedgerService {
  constructor(
    private readonly ledger: LedgerRepository,
    private readonly context: RequestContext,
  ) {}

  async post(input: JournalInput) {
    const lines = input.lines.filter((line) => (line.debit ?? 0n) > 0n || (line.credit ?? 0n) > 0n);
    const debit = lines.reduce((sum, line) => sum + (line.debit ?? 0n), 0n);
    const credit = lines.reduce((sum, line) => sum + (line.credit ?? 0n), 0n);
    if (debit !== credit || lines.some((line) => (line.debit ?? 0n) > 0n && (line.credit ?? 0n) > 0n)) throw new Error(`Unbalanced ${input.kind} journal for ${input.sourceType} ${input.sourceId}`);
    if (lines.length === 0) return null;
    const actor = this.context.actor;
    const journal = await this.ledger.createJournal({ kind: input.kind, sourceType: input.sourceType, sourceId: input.sourceId, memo: input.memo, postedByUserId: actor?.type === 'user' ? actor.userId : null });
    const entries = [];
    for (const line of lines) entries.push({ journalId: journal.id, accountId: (await this.ledger.ensureAccount(line.account)).id, debitPaise: line.debit ?? 0n, creditPaise: line.credit ?? 0n });
    await this.ledger.createEntries(entries);
    return journal;
  }

  async balanceOf(account: LedgerAccountSpec, before?: Date) {
    const found = await this.ledger.findAccount(account.code);
    if (!found) return 0n;
    const sums = await this.ledger.balance(found.id, before);
    return sums.debitPaise - sums.creditPaise;
  }

  async trialBalance() {
    const rows = await this.ledger.balances();
    const accounts = new Map((await this.ledger.accounts(rows.map((row) => row.accountId))).map((account) => [account.id, account]));
    const items = rows
      .map((row) => {
        const account = accounts.get(row.accountId);
        const debit = row._sum.debitPaise ?? 0n;
        const credit = row._sum.creditPaise ?? 0n;
        return { code: account?.code ?? row.accountId, name: account?.name ?? null, type: account?.type ?? null, organizationId: account?.organizationId ?? null, debitPaise: paiseToNumber(debit), creditPaise: paiseToNumber(credit), balancePaise: paiseToNumber(debit - credit) };
      })
      .toSorted((left, right) => left.code.localeCompare(right.code));
    return { items, totals: { debitPaise: items.reduce((sum, item) => sum + item.debitPaise, 0), creditPaise: items.reduce((sum, item) => sum + item.creditPaise, 0) } };
  }

  async entries(account: LedgerAccountSpec, query: PageQuery) {
    const found = await this.ledger.findAccount(account.code);
    if (!found) return { items: [], nextCursor: null };
    const window = pageWindow(query);
    const rows = await this.ledger.entries(found.id, window.idFilter, window.take);
    return toPage(rows, query.limit, (row) => ({ id: row.id, kind: row.journal.kind, sourceType: row.journal.sourceType, sourceId: row.journal.sourceId, memo: row.journal.memo, debitPaise: paiseToNumber(row.debitPaise), creditPaise: paiseToNumber(row.creditPaise), postedAt: row.journal.postedAt.toISOString() }));
  }
}
