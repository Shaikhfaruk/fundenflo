import { ReceivableStatus } from '../../../common/enums/db.enums.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import type { PartnerPayout, Receivable, ReconciliationRun } from '../../../generated/prisma/client.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

const money = (value: bigint) => paiseToNumber(value);

export const toPayoutSummary = (payout: PartnerPayout) => ({ id: payout.id, ref: payout.ref, status: payout.status, partnerOrganizationId: payout.partnerOrganizationId, grossPaise: money(payout.grossPaise), netPaise: money(payout.netPaise) });

export const toReceivableView = (receivable: Receivable & { payouts: PartnerPayout[] }) => ({
  id: receivable.id,
  ref: receivable.ref,
  status: receivable.status,
  lenderId: receivable.lenderId,
  lenderOrganizationId: receivable.lenderOrganizationId,
  submissionId: receivable.submissionId,
  applicationId: receivable.applicationId,
  scheme: { documentId: receivable.schemeDocumentId, versionId: receivable.schemeVersionId },
  basePaise: money(receivable.basePaise),
  feePaise: money(receivable.feePaise),
  gstRateBps: receivable.gstRateBps,
  gstPaise: money(receivable.gstPaise),
  totalPaise: money(receivable.totalPaise),
  receivedPaise: money(receivable.receivedPaise),
  outstandingPaise: money(receivable.status === ReceivableStatus.written_off ? 0n : receivable.totalPaise - receivable.receivedPaise),
  invoiceNumber: receivable.invoiceNumber,
  invoicedAt: iso(receivable.invoicedAt),
  receivedAt: iso(receivable.receivedAt),
  utr: receivable.utr,
  reconciledAt: iso(receivable.reconciledAt),
  reconciliationRunId: receivable.reconciliationRunId,
  writtenOffAt: iso(receivable.writtenOffAt),
  writeOffReason: receivable.writeOffReason,
  payout: receivable.payouts[0] ? toPayoutSummary(receivable.payouts[0]) : null,
  version: receivable.version,
  createdAt: receivable.createdAt.toISOString(),
});

export const toPayoutView = (payout: PartnerPayout & { receivable: Receivable }, staff: boolean) => ({
  id: payout.id,
  ref: payout.ref,
  status: payout.status,
  partnerOrganizationId: payout.partnerOrganizationId,
  receivable: { id: payout.receivable.id, ref: payout.receivable.ref, status: payout.receivable.status },
  submissionId: payout.submissionId,
  applicationId: payout.applicationId,
  scheme: { documentId: payout.schemeDocumentId, versionId: payout.schemeVersionId },
  basePaise: money(payout.basePaise),
  grossPaise: money(payout.grossPaise),
  tdsRateBps: payout.tdsRateBps,
  tdsPaise: money(payout.tdsPaise),
  netPaise: money(payout.netPaise),
  approvedAt: iso(payout.approvedAt),
  paidAt: iso(payout.paidAt),
  utr: payout.utr,
  reversedAt: iso(payout.reversedAt),
  reverseReason: payout.reverseReason,
  ...(staff ? { attributionId: payout.attributionId, approvedByUserId: payout.approvedByUserId, paidByUserId: payout.paidByUserId } : {}),
  version: payout.version,
  createdAt: payout.createdAt.toISOString(),
});

export const toRunView = (run: ReconciliationRun) => ({
  id: run.id,
  lenderOrganizationId: run.lenderOrganizationId,
  source: run.source,
  lineCount: run.lineCount,
  matchedCount: run.matchedCount,
  totalPaise: money(run.totalPaise),
  matchedPaise: money(run.matchedPaise),
  unmatched: run.unmatched,
  createdByUserId: run.createdByUserId,
  createdAt: run.createdAt.toISOString(),
});
