import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { PayoutStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { startOfDisplayMonth } from '../../../common/i18n/date-format.js';
import type { PageQuery } from '../../../common/listing/cursor-page.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import { LedgerAccounts } from '../domain/commission.constants.js';
import { CommissionRepository } from '../infrastructure/commission.repository.js';
import { toPayoutView } from './commission.views.js';
import { LedgerService } from './ledger.service.js';

const MONTH = /^(\d{4})-(\d{2})$/;

const MID_MONTH_DAY = 15;

const STATEMENT_LIMIT = 500;

@Injectable()
export class PartnerCommissionService {
  constructor(
    private readonly commissions: CommissionRepository,
    private readonly ledger: LedgerService,
  ) {}

  async summary(actor: UserActor) {
    const organizationId = this.organizationOf(actor);
    const totals = await this.commissions.payoutTotals({ partnerOrganizationId: organizationId });
    const byStatus = Object.fromEntries(
      Object.values(PayoutStatus).map((status) => {
        const row = totals.find((candidate) => candidate.status === status);
        return [status, { count: row?._count.id ?? 0, grossPaise: paiseToNumber(row?._sum.grossPaise ?? 0n), tdsPaise: paiseToNumber(row?._sum.tdsPaise ?? 0n), netPaise: paiseToNumber(row?._sum.netPaise ?? 0n) }];
      }),
    );
    return { payablePaise: paiseToNumber(-(await this.ledger.balanceOf(LedgerAccounts.partnerPayable(organizationId)))), byStatus };
  }

  async ledgerEntries(actor: UserActor, query: PageQuery) {
    return this.ledger.entries(LedgerAccounts.partnerPayable(this.organizationOf(actor)), query);
  }

  async statement(actor: UserActor, month: string) {
    const organizationId = this.organizationOf(actor);
    const match = MONTH.exec(month);
    if (!match) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'month', code: 'invalid_format', message: 'use YYYY-MM' }] });
    const [year, monthIndex] = [Number(match[1]), Number(match[2]) - 1];
    const start = startOfDisplayMonth(new Date(Date.UTC(year, monthIndex, MID_MONTH_DAY)));
    const end = startOfDisplayMonth(new Date(Date.UTC(year, monthIndex + 1, MID_MONTH_DAY)));
    const account = LedgerAccounts.partnerPayable(organizationId);
    const paid = await this.commissions.listPayouts({ partnerOrganizationId: organizationId, status: PayoutStatus.paid, paidAt: { gte: start, lt: end } }, STATEMENT_LIMIT);
    const sum = (pick: (row: (typeof paid)[number]) => bigint) => paiseToNumber(paid.reduce((total, row) => total + pick(row), 0n));
    return {
      month,
      period: { from: start.toISOString(), to: end.toISOString() },
      openingPayablePaise: paiseToNumber(-(await this.ledger.balanceOf(account, start))),
      closingPayablePaise: paiseToNumber(-(await this.ledger.balanceOf(account, end))),
      paid: { count: paid.length, grossPaise: sum((row) => row.grossPaise), tdsPaise: sum((row) => row.tdsPaise), netPaise: sum((row) => row.netPaise) },
      items: paid.map((row) => toPayoutView(row, false)),
    };
  }

  private organizationOf(actor: UserActor) {
    if (!actor.organizationId) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED);
    return actor.organizationId;
  }
}
