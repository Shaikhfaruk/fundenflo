import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { ConfigResource, JournalKind, type PayoutStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { applyBps } from '../../../engines/commissions/commission-math.js';
import type { CompiledCommissionScheme } from '../../../engines/commissions/commissions.types.js';
import { COLLECTED_RECEIVABLE_STATES, PayoutEvent, payoutMachine } from '../../../engines/state-machines/machines/commission.machine.js';
import type { PartnerPayout, Prisma } from '../../../generated/prisma/client.js';
import { OrganizationService } from '../../access/application/organization.service.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { LeadAttributionService } from '../../partners/application/lead-attribution.service.js';
import { PartnerKycService } from '../../partners/application/partner-kyc.service.js';
import { RiskService } from '../../risk/application/risk.service.js';
import { LedgerAccounts, LedgerSource } from '../domain/commission.constants.js';
import { CommissionRepository } from '../infrastructure/commission.repository.js';
import { toPayoutView } from './commission.views.js';
import { LedgerService } from './ledger.service.js';

export type PayoutFilters = { status?: PayoutStatus; partnerOrganizationId?: string };

const dateOf = (value: string | undefined) => (value ? new Date(`${value}T00:00:00.000Z`) : new Date());

const refuse = (code: string, message: string) => new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'payout', code, message }] });

@Injectable()
export class PayoutService {
  constructor(
    private readonly commissions: CommissionRepository,
    private readonly ledger: LedgerService,
    private readonly kyc: PartnerKycService,
    private readonly attributions: LeadAttributionService,
    private readonly config: ConfigPublishingService,
    private readonly audit: AuditService,
    private readonly changes: ChangeRecorder,
    private readonly risk: RiskService,
    private readonly organizations: OrganizationService,
  ) {}

  async list(ability: AppAbility, query: PageQuery & PayoutFilters) {
    const window = pageWindow(query);
    const rows = await this.commissions.listPayouts({ AND: [accessibleBy(ability, AppAction.Read).ofType('PartnerPayout'), { id: window.idFilter, status: query.status, partnerOrganizationId: query.partnerOrganizationId }] }, window.take);
    const names = await this.organizations.names(rows.map((row) => row.partnerOrganizationId));
    return toPage(rows, query.limit, (row) => toPayoutView(row, true, names.get(row.partnerOrganizationId) ?? null));
  }

  async detail(id: string, ability: AppAbility) {
    const payout = await this.visible(id, ability, AppAction.Read);
    const bankAccount = await this.kyc.bankAccount(payout.partnerOrganizationId);
    await this.audit.record({ action: AuditAction.PayoutBankAccountViewed, entityType: AuditEntity.PartnerPayout, entityId: id, metadata: { partnerOrganizationId: payout.partnerOrganizationId } });
    return { ...toPayoutView(payout, true, await this.partnerName(payout.partnerOrganizationId)), bankAccount };
  }

  @Transactional()
  async approve(id: string, expectedVersion: number | undefined, actor: UserActor, ability: AppAbility) {
    await this.commissions.lockPayout(id);
    const payout = await this.visible(id, ability, AppAction.Update);
    assertVersion(expectedVersion, payout.version);
    transitionOrThrow(payoutMachine, payout.status, PayoutEvent.Approve);
    if (!COLLECTED_RECEIVABLE_STATES.includes(payout.receivable.status)) throw refuse('awaiting_lender_payment', 'the lender has not paid this commission yet');
    if (!(await this.kyc.payoutReady(payout.partnerOrganizationId))) throw refuse('kyc_incomplete', 'the firm needs a verified PAN and a bank account first');
    await this.risk.assertClear({ organizationIds: [payout.partnerOrganizationId], applicationId: payout.applicationId });
    const attribution = payout.attributionId ? await this.attributions.byId(payout.attributionId) : null;
    if (attribution && (attribution.disputedAt || attribution.endedAt)) throw refuse('attribution_disputed', 'the attribution of this borrower is disputed or ended');
    const scheme = await this.config.pinnedVersion<CompiledCommissionScheme>(ConfigResource.commission_scheme, payout.schemeVersionId);
    const tdsRateBps = scheme ? ((await this.kyc.panVerified(payout.partnerOrganizationId)) ? scheme.compiled.tdsRateBps : scheme.compiled.tdsNoPanRateBps) : payout.tdsRateBps;
    const tds = applyBps(payout.grossPaise, tdsRateBps);
    await this.move(payout, PayoutEvent.Approve, { approvedByUserId: actor.userId, approvedAt: new Date(), tdsRateBps, tdsPaise: tds, netPaise: payout.grossPaise - tds }, EventName.PayoutApproved);
    return this.view(id, ability);
  }

  @Transactional()
  async markPaid(id: string, input: { utr: string; paidOn?: string; expectedVersion?: number }, actor: UserActor, ability: AppAbility) {
    await this.commissions.lockPayout(id);
    const payout = await this.visible(id, ability, AppAction.Update);
    assertVersion(input.expectedVersion, payout.version);
    if (payout.approvedByUserId === actor.userId) throw new AppError(ErrorCode.FORBIDDEN, { details: { reason: 'second_person_required' } });
    await this.move(payout, PayoutEvent.Pay, { paidByUserId: actor.userId, paidAt: dateOf(input.paidOn), utr: input.utr }, EventName.PayoutPaid, { netPaise: payout.netPaise.toString(), tdsPaise: payout.tdsPaise.toString(), utr: input.utr });
    await this.ledger.post({
      kind: JournalKind.payout_paid,
      sourceType: LedgerSource.Payout,
      sourceId: id,
      memo: `${payout.ref} paid (UTR ${input.utr})`,
      lines: [{ account: LedgerAccounts.partnerPayable(payout.partnerOrganizationId), debit: payout.grossPaise }, { account: LedgerAccounts.bank, credit: payout.netPaise }, { account: LedgerAccounts.tdsPayable, credit: payout.tdsPaise }],
    });
    return this.view(id, ability);
  }

  @Transactional()
  async reverse(id: string, input: { reason: string; expectedVersion?: number }, ability: AppAbility) {
    await this.commissions.lockPayout(id);
    const payout = await this.visible(id, ability, AppAction.Update);
    assertVersion(input.expectedVersion, payout.version);
    await this.reverseUnpaid(id, input.reason);
    return this.view(id, ability);
  }

  async reverseUnpaid(id: string, reason: string) {
    const payout = await this.commissions.findPayout({ id });
    if (!payout) throw new AppError(ErrorCode.NOT_FOUND);
    await this.move(payout, PayoutEvent.Reverse, { reversedAt: new Date(), reverseReason: reason }, EventName.PayoutReversed);
    await this.ledger.post({ kind: JournalKind.payout_reversed, sourceType: LedgerSource.Payout, sourceId: id, memo: `${payout.ref} reversed: ${reason}`, lines: [{ account: LedgerAccounts.partnerPayable(payout.partnerOrganizationId), debit: payout.grossPaise }, { account: LedgerAccounts.expense, credit: payout.grossPaise }] });
  }

  private async move(payout: PartnerPayout, event: PayoutEvent, data: Prisma.PartnerPayoutUncheckedUpdateManyInput, eventName: EventName, extra: Record<string, unknown> = {}) {
    const next = transitionOrThrow(payoutMachine, payout.status, event);
    const moved = await this.commissions.updatePayoutFromStatus(payout.id, payout.status, { ...data, status: next });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.changes.record({
      action: AuditAction.PayoutChanged,
      entityType: AuditEntity.PartnerPayout,
      entityId: payout.id,
      event: eventName,
      metadata: { ref: payout.ref, from: payout.status, to: next, ...extra },
      payload: { payoutId: payout.id, ref: payout.ref, partnerOrganizationId: payout.partnerOrganizationId, from: payout.status, to: next, ...extra },
    });
  }

  private async view(id: string, ability: AppAbility) {
    const payout = await this.visible(id, ability, AppAction.Read);
    return toPayoutView(payout, true, await this.partnerName(payout.partnerOrganizationId));
  }

  private async partnerName(organizationId: string) {
    return (await this.organizations.names([organizationId])).get(organizationId) ?? null;
  }

  private async visible(id: string, ability: AppAbility, action: AppAction) {
    const payout = await this.commissions.findPayout({ AND: [accessibleBy(ability, action).ofType('PartnerPayout'), { id }] });
    if (!payout) throw new AppError(ErrorCode.NOT_FOUND);
    return payout;
  }
}
