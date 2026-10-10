import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { JournalKind, PayoutStatus, type ReceivableStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { paiseFromNumber } from '../../../common/money/paise.js';
import { ReceivableEvent, receivableMachine } from '../../../engines/state-machines/machines/commission.machine.js';
import type { PartnerPayout, Prisma, Receivable } from '../../../generated/prisma/client.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { LedgerAccounts, LedgerSource, PayoutReverseReason, ReceivableAction } from '../domain/commission.constants.js';
import { CommissionRepository } from '../infrastructure/commission.repository.js';
import { toReceivableView } from './commission.views.js';
import { LedgerService } from './ledger.service.js';
import { PayoutService } from './payout.service.js';

export type ReceivableActionInput = { action: ReceivableAction; invoiceNumber?: string; amountPaise?: number; on?: string; utr?: string; reason?: string; expectedVersion?: number };

export type ReceivableFilters = { status?: ReceivableStatus; lenderId?: string; submissionId?: string };

type ReceivableRow = Receivable & { payouts: PartnerPayout[] };

const dateOf = (value: string | undefined) => (value ? new Date(`${value}T00:00:00.000Z`) : new Date());

@Injectable()
export class ReceivableService {
  constructor(
    private readonly commissions: CommissionRepository,
    private readonly ledger: LedgerService,
    private readonly payouts: PayoutService,
    private readonly audit: AuditService,
    private readonly changes: ChangeRecorder,
  ) {}

  async list(ability: AppAbility, query: PageQuery & ReceivableFilters) {
    const window = pageWindow(query);
    const rows = await this.commissions.listReceivables({ AND: [accessibleBy(ability, AppAction.Read).ofType('Receivable'), { id: window.idFilter, status: query.status, lenderId: query.lenderId, submissionId: query.submissionId }] }, window.take);
    return toPage(rows, query.limit, toReceivableView);
  }

  async get(id: string, ability: AppAbility) {
    return toReceivableView(await this.visible(id, ability, AppAction.Read));
  }

  @Transactional()
  async act(id: string, input: ReceivableActionInput, ability: AppAbility) {
    await this.commissions.lockReceivable(id);
    const receivable = await this.visible(id, ability, AppAction.Update);
    assertVersion(input.expectedVersion, receivable.version);
    if (input.action === ReceivableAction.Invoice) {
      if (!input.invoiceNumber) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'invoiceNumber', code: 'required', message: 'enter the invoice number' }] });
      await this.move(receivable, ReceivableEvent.Invoice, { invoiceNumber: input.invoiceNumber, invoicedAt: dateOf(input.on) });
    } else if (input.action === ReceivableAction.Receive) {
      if (!input.amountPaise) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'amountPaise', code: 'required', message: 'enter the amount received' }] });
      await this.receive(receivable, paiseFromNumber(input.amountPaise), { utr: input.utr, on: input.on });
    } else if (input.action === ReceivableAction.Reconcile) {
      await this.move(receivable, ReceivableEvent.Reconcile, { reconciledAt: new Date() });
    } else {
      await this.writeOff(receivable, input.reason);
    }
    const metadata = { ref: receivable.ref, action: input.action, amountPaise: input.amountPaise ?? null, utr: input.utr ?? null, reason: input.reason ?? null };
    if (input.action === ReceivableAction.WriteOff) await this.changes.record({ action: AuditAction.ReceivableChanged, entityType: AuditEntity.Receivable, entityId: id, event: EventName.ReceivableWrittenOff, metadata, payload: { receivableId: id, lenderOrganizationId: receivable.lenderOrganizationId } });
    else await this.audit.record({ action: AuditAction.ReceivableChanged, entityType: AuditEntity.Receivable, entityId: id, metadata });
    return this.get(id, ability);
  }

  async receive(receivable: ReceivableRow, amount: bigint, details: { utr?: string; on?: string; reconcile?: boolean }) {
    const outstanding = receivable.totalPaise - receivable.receivedPaise;
    if (amount <= 0n || amount > outstanding) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'amountPaise', code: 'over_payment', message: `at most ${outstanding} paise is outstanding` }] });
    const received = receivable.receivedPaise + amount;
    const full = received === receivable.totalPaise;
    const reconcile = full && details.reconcile === true;
    const status = full ? transitionOrThrow(receivableMachine, receivable.status, ReceivableEvent.Receive) : receivable.status;
    const data: Prisma.ReceivableUncheckedUpdateManyInput = {
      receivedPaise: received,
      utr: details.utr ?? receivable.utr,
      ...(full ? { status: reconcile ? transitionOrThrow(receivableMachine, status, ReceivableEvent.Reconcile) : status, receivedAt: dateOf(details.on) } : {}),
      ...(reconcile ? { reconciledAt: new Date() } : {}),
    };
    const moved = await this.commissions.updateReceivableFromStatus(receivable.id, receivable.status, data);
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.ledger.post({ kind: JournalKind.receivable_received, sourceType: LedgerSource.Receivable, sourceId: receivable.id, memo: `${receivable.ref} received${details.utr ? ` (UTR ${details.utr})` : ''}`, lines: [{ account: LedgerAccounts.bank, debit: amount }, { account: LedgerAccounts.lenderReceivable(receivable.lenderOrganizationId), credit: amount }] });
    if (full) await this.changes.record({ action: AuditAction.ReceivableChanged, entityType: AuditEntity.Receivable, entityId: receivable.id, event: EventName.ReceivableReceived, metadata: { ref: receivable.ref, receivedPaise: received.toString() }, payload: { receivableId: receivable.id, lenderOrganizationId: receivable.lenderOrganizationId } });
    return full;
  }

  private async writeOff(receivable: ReceivableRow, reason: string | undefined) {
    if (!reason) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'reason', code: 'required', message: 'say why the receivable is written off' }] });
    if (receivable.receivedPaise > 0n) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'action', code: 'partially_received', message: 'part of this receivable was received; reconcile it instead' }] });
    await this.move(receivable, ReceivableEvent.WriteOff, { writtenOffAt: new Date(), writeOffReason: reason });
    await this.ledger.post({
      kind: JournalKind.receivable_written_off,
      sourceType: LedgerSource.Receivable,
      sourceId: receivable.id,
      memo: `${receivable.ref} written off: ${reason}`,
      lines: [{ account: LedgerAccounts.revenue, debit: receivable.feePaise }, { account: LedgerAccounts.gstOutput, debit: receivable.gstPaise }, { account: LedgerAccounts.lenderReceivable(receivable.lenderOrganizationId), credit: receivable.totalPaise }],
    });
    for (const payout of receivable.payouts.filter((row) => row.status === PayoutStatus.pending || row.status === PayoutStatus.approved)) await this.payouts.reverseUnpaid(payout.id, PayoutReverseReason.ReceivableWrittenOff);
  }

  private async move(receivable: Receivable, event: ReceivableEvent, data: Prisma.ReceivableUncheckedUpdateManyInput) {
    const next = transitionOrThrow(receivableMachine, receivable.status, event);
    const moved = await this.commissions.updateReceivableFromStatus(receivable.id, receivable.status, { ...data, status: next });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
  }

  private async visible(id: string, ability: AppAbility, action: AppAction) {
    const receivable = await this.commissions.findReceivable({ AND: [accessibleBy(ability, action).ofType('Receivable'), { id }] });
    if (!receivable) throw new AppError(ErrorCode.NOT_FOUND);
    return receivable;
  }
}
