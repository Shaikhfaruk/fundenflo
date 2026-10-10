import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { paiseFromNumber } from '../../../common/money/paise.js';
import { OPEN_RECEIVABLE_STATES } from '../../../engines/state-machines/machines/commission.machine.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { OrganizationService } from '../../access/application/organization.service.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { LenderService } from '../../lenders/application/lender.service.js';
import { UnmatchedReason } from '../domain/commission.constants.js';
import { CommissionRepository } from '../infrastructure/commission.repository.js';
import { toRunView } from './commission.views.js';
import { ReceivableService } from './receivable.service.js';

export type ReconciliationLine = { reference: string; amountPaise: number; utr?: string; paidOn?: string };

export type ReconciliationInput = { lenderId?: string; source: string; lines: ReconciliationLine[] };

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly commissions: CommissionRepository,
    private readonly receivables: ReceivableService,
    private readonly lenders: LenderService,
    private readonly changes: ChangeRecorder,
    private readonly organizations: OrganizationService,
  ) {}

  async list(ability: AppAbility, query: PageQuery) {
    const window = pageWindow(query);
    const rows = await this.commissions.listRuns({ AND: [accessibleBy(ability, AppAction.Read).ofType('ReconciliationRun'), { id: window.idFilter }] }, window.take);
    const names = await this.organizations.names(rows.flatMap((row) => (row.lenderOrganizationId ? [row.lenderOrganizationId] : [])));
    return toPage(rows, query.limit, (row) => toRunView(row, row.lenderOrganizationId ? (names.get(row.lenderOrganizationId) ?? null) : null));
  }

  @Transactional()
  async run(input: ReconciliationInput, actor: UserActor) {
    const lenderOrganizationId = input.lenderId ? ((await this.lenders.summaries([input.lenderId])).get(input.lenderId)?.organizationId ?? null) : null;
    if (input.lenderId && !lenderOrganizationId) throw new AppError(ErrorCode.NOT_FOUND, { details: { lenderId: input.lenderId } });
    const scope: Prisma.ReceivableWhereInput = lenderOrganizationId ? { lenderOrganizationId } : {};
    const unmatched: Array<ReconciliationLine & { reason: string }> = [];
    const reconciled: string[] = [];
    let matchedPaise = 0n;
    let totalPaise = 0n;
    for (const line of input.lines) {
      const amount = paiseFromNumber(line.amountPaise);
      totalPaise += amount;
      const reference = line.reference.trim();
      const found = await this.commissions.findReceivable({ AND: [scope, { OR: [{ ref: reference.toUpperCase() }, { invoiceNumber: reference }] }] });
      if (!found) {
        unmatched.push({ ...line, reason: UnmatchedReason.NotFound });
        continue;
      }
      await this.commissions.lockReceivable(found.id);
      const receivable = await this.commissions.findReceivable({ id: found.id });
      if (!receivable || !OPEN_RECEIVABLE_STATES.includes(receivable.status)) {
        unmatched.push({ ...line, reason: UnmatchedReason.Closed });
        continue;
      }
      if (amount > receivable.totalPaise - receivable.receivedPaise) {
        unmatched.push({ ...line, reason: UnmatchedReason.OverPayment });
        continue;
      }
      if (await this.receivables.receive(receivable, amount, { utr: line.utr, on: line.paidOn, reconcile: true })) reconciled.push(receivable.id);
      matchedPaise += amount;
    }
    const run = await this.commissions.createRun({
      lenderOrganizationId,
      source: input.source,
      lineCount: input.lines.length,
      matchedCount: input.lines.length - unmatched.length,
      totalPaise,
      matchedPaise,
      unmatched,
      createdByUserId: actor.userId,
    });
    for (const id of reconciled) await this.commissions.linkRun(id, run.id);
    await this.changes.record({
      action: AuditAction.ReconciliationCompleted,
      entityType: AuditEntity.ReconciliationRun,
      entityId: run.id,
      event: EventName.ReconciliationCompleted,
      metadata: { lineCount: run.lineCount, matchedCount: run.matchedCount, reconciled: reconciled.length },
      payload: { reconciliationRunId: run.id, lenderOrganizationId },
    });
    const lenderName = lenderOrganizationId ? ((await this.organizations.names([lenderOrganizationId])).get(lenderOrganizationId) ?? null) : null;
    return { ...toRunView(run, lenderName), reconciledReceivableIds: reconciled };
  }
}
