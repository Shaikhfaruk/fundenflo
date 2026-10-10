import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ConfigResource, JournalKind } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { applyBps, computeCommission, selectScheme } from '../../../engines/commissions/commission-math.js';
import { type CompiledCommissionScheme, SchemeBase, SchemeParty } from '../../../engines/commissions/commissions.types.js';
import { RefGenerator, RefKind } from '../../../infrastructure/database/ref-generator.js';
import type { ApplicationSubject } from '../../applications/application/application.service.js';
import { ApplicationService } from '../../applications/application/application.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import type { PublishedConfig } from '../../config-publishing/domain/config.types.js';
import { LenderService } from '../../lenders/application/lender.service.js';
import { LeadAttributionService } from '../../partners/application/lead-attribution.service.js';
import { PartnerKycService } from '../../partners/application/partner-kyc.service.js';
import { PartnerService } from '../../partners/application/partner.service.js';
import type { Receivable } from '../../../generated/prisma/client.js';
import { LedgerAccounts, LedgerSource } from '../domain/commission.constants.js';
import { CommissionRepository } from '../infrastructure/commission.repository.js';
import { LedgerService } from './ledger.service.js';

export type DisbursalPayload = { submissionId?: string; ref?: string; applicationId?: string; lenderId?: string; lenderOrganizationId?: string; amountPaise?: number };

type Scheme = PublishedConfig<CompiledCommissionScheme>;

@Injectable()
export class CommissionService {
  constructor(
    private readonly commissions: CommissionRepository,
    private readonly ledger: LedgerService,
    private readonly applications: ApplicationService,
    private readonly lenders: LenderService,
    private readonly partners: PartnerService,
    private readonly kyc: PartnerKycService,
    private readonly attributions: LeadAttributionService,
    private readonly config: ConfigPublishingService,
    private readonly refs: RefGenerator,
    private readonly audit: AuditService,
    private readonly changes: ChangeRecorder,
  ) {}

  @Transactional()
  async accrue(eventId: string, payload: DisbursalPayload) {
    const existing = await this.commissions.findReceivable({ sourceEventId: eventId });
    if (existing) return { receivableId: existing.id, payoutId: existing.payouts[0]?.id ?? null };
    if (!payload.submissionId || !payload.applicationId || !payload.lenderId || !payload.lenderOrganizationId || !payload.amountPaise) return null;
    const base = BigInt(payload.amountPaise);
    const application = await this.applications.subject(payload.applicationId);
    const lenderKey = (await this.lenders.summaries([payload.lenderId])).get(payload.lenderId)?.key ?? null;
    const schemes = await this.config.active<CompiledCommissionScheme>(ConfigResource.commission_scheme);
    const agreedKey = await this.lenders.commissionSchemeKey(payload.lenderId);
    const context = { lenderKey, category: application.categoryKey, partnerKind: null, partnerLevel: null };
    const scheme = agreedKey ? (schemes.find((candidate) => candidate.key === agreedKey && candidate.compiled.party === SchemeParty.Lender) ?? null) : selectScheme(schemes, SchemeParty.Lender, context);
    if (!scheme) {
      await this.audit.record({ action: AuditAction.CommissionUnscheduled, entityType: AuditEntity.LenderSubmission, entityId: payload.submissionId, metadata: { party: SchemeParty.Lender, lenderKey, agreedKey } });
      return null;
    }
    const fee = computeCommission(scheme.compiled, base);
    const gst = applyBps(fee, scheme.compiled.gstRateBps);
    const receivable = await this.commissions.createReceivable({
      ref: await this.refs.next(RefKind.Receivable),
      sourceEventId: eventId,
      lenderId: payload.lenderId,
      lenderOrganizationId: payload.lenderOrganizationId,
      submissionId: payload.submissionId,
      applicationId: payload.applicationId,
      schemeDocumentId: scheme.documentId,
      schemeVersionId: scheme.versionId,
      basePaise: base,
      feePaise: fee,
      gstRateBps: scheme.compiled.gstRateBps,
      gstPaise: gst,
      totalPaise: fee + gst,
    });
    await this.ledger.post({
      kind: JournalKind.receivable_accrued,
      sourceType: LedgerSource.Receivable,
      sourceId: receivable.id,
      memo: `${receivable.ref} on disbursal of ${payload.ref ?? payload.submissionId}`,
      lines: [{ account: LedgerAccounts.lenderReceivable(payload.lenderOrganizationId), debit: fee + gst }, { account: LedgerAccounts.revenue, credit: fee }, { account: LedgerAccounts.gstOutput, credit: gst }],
    });
    await this.changes.record({
      action: AuditAction.ReceivableAccrued,
      entityType: AuditEntity.Receivable,
      entityId: receivable.id,
      event: EventName.ReceivableAccrued,
      metadata: { ref: receivable.ref, submissionId: payload.submissionId, scheme: scheme.key, feePaise: fee.toString(), gstPaise: gst.toString() },
      payload: { receivableId: receivable.id, lenderOrganizationId: payload.lenderOrganizationId, submissionId: payload.submissionId },
    });
    const payout = await this.accruePayout(receivable, application, schemes, lenderKey);
    return { receivableId: receivable.id, payoutId: payout?.id ?? null };
  }

  private async accruePayout(receivable: Receivable, application: ApplicationSubject, schemes: Scheme[], lenderKey: string | null) {
    const attribution = !application.partnerOrganizationId && application.leadId ? ((await this.attributions.forLeads([application.leadId])).find((row) => row.endedAt === null) ?? null) : null;
    const organizationId = application.partnerOrganizationId ?? attribution?.organizationId ?? null;
    if (!organizationId) return null;
    const partner = await this.partners.summaryOf(organizationId);
    if (!partner) return null;
    const scheme = selectScheme(schemes, SchemeParty.Partner, { lenderKey, category: application.categoryKey, partnerKind: partner.kind, partnerLevel: partner.level });
    if (!scheme) {
      await this.audit.record({ action: AuditAction.CommissionUnscheduled, entityType: AuditEntity.Receivable, entityId: receivable.id, metadata: { party: SchemeParty.Partner, partnerOrganizationId: organizationId } });
      return null;
    }
    const base = scheme.compiled.base === SchemeBase.LenderFee ? receivable.feePaise : receivable.basePaise;
    const gross = computeCommission(scheme.compiled, base);
    const tdsRateBps = (await this.kyc.panVerified(organizationId)) ? scheme.compiled.tdsRateBps : scheme.compiled.tdsNoPanRateBps;
    const tds = applyBps(gross, tdsRateBps);
    const payout = await this.commissions.createPayout({
      ref: await this.refs.next(RefKind.Payout),
      receivableId: receivable.id,
      partnerOrganizationId: organizationId,
      submissionId: receivable.submissionId,
      applicationId: receivable.applicationId,
      attributionId: attribution?.id ?? null,
      schemeDocumentId: scheme.documentId,
      schemeVersionId: scheme.versionId,
      basePaise: base,
      grossPaise: gross,
      tdsRateBps,
      tdsPaise: tds,
      netPaise: gross - tds,
    });
    await this.ledger.post({ kind: JournalKind.payout_accrued, sourceType: LedgerSource.Payout, sourceId: payout.id, memo: `${payout.ref} for ${receivable.ref}`, lines: [{ account: LedgerAccounts.expense, debit: gross }, { account: LedgerAccounts.partnerPayable(organizationId), credit: gross }] });
    await this.changes.record({
      action: AuditAction.PayoutAccrued,
      entityType: AuditEntity.PartnerPayout,
      entityId: payout.id,
      event: EventName.PayoutAccrued,
      metadata: { ref: payout.ref, receivableId: receivable.id, scheme: scheme.key, grossPaise: gross.toString(), tdsRateBps },
      payload: { payoutId: payout.id, partnerOrganizationId: organizationId, receivableId: receivable.id },
    });
    return payout;
  }
}
