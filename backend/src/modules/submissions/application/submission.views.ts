import { type Locale, localise } from '../../../common/i18n/locale.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import { SubmissionEventType } from '../../../common/enums/db.enums.js';
import type { DocumentRequest, LenderSubmission, SubmissionEvent } from '../../../generated/prisma/client.js';
import { REJECTION_REASON_LABELS, type RejectionReason } from '../domain/submission.constants.js';

export const SubmissionAudience = {
  Borrower: 'borrower',
  Lender: 'lender',
  Staff: 'staff',
} as const;

export type SubmissionAudience = (typeof SubmissionAudience)[keyof typeof SubmissionAudience];

export type LenderSummary = { id: string; key: string; name: string; organizationId: string };

export type SubmissionNames = { lenders: Map<string, LenderSummary>; products: Map<string, unknown> };

const iso = (value: Date | null) => value?.toISOString() ?? null;

export const toSubmissionView = (submission: LenderSubmission, names: SubmissionNames, locale: Locale, audience: SubmissionAudience) => {
  const lender = names.lenders.get(submission.lenderId);
  return {
    id: submission.id,
    ref: submission.ref,
    applicationId: submission.applicationId,
    status: submission.status,
    lender: lender ? { id: lender.id, key: lender.key, name: lender.name } : { id: submission.lenderId, key: null, name: null },
    product: { id: submission.productDocumentId, key: submission.productKey, versionId: submission.productVersionId, name: localise(names.products.get(submission.productDocumentId) ?? { en: submission.productKey }, locale) || submission.productKey },
    matchResultId: submission.matchResultId,
    approvedAt: iso(submission.approvedAt),
    sentAt: iso(submission.sentAt),
    lenderReference: submission.lenderReference,
    sanction: submission.sanctionedAmountPaise === null ? null : { amountPaise: paiseToNumber(submission.sanctionedAmountPaise), sanctionedAt: iso(submission.sanctionedAt), letterDocumentId: submission.sanctionLetterDocumentId },
    disbursal: { amountPaise: paiseToNumber(submission.disbursedAmountPaise), disbursedAt: iso(submission.disbursedAt) },
    rejection: submission.rejectionReason
      ? { reason: submission.rejectionReason, label: localise(REJECTION_REASON_LABELS[submission.rejectionReason as RejectionReason] ?? { en: submission.rejectionReason }, locale), ...(audience === SubmissionAudience.Borrower ? {} : { note: submission.rejectionNote }) }
      : null,
    withdrawnReason: submission.withdrawnReason,
    closedAt: iso(submission.closedAt),
    version: submission.version,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  };
};

export const toSubmissionEventView = (event: SubmissionEvent) => ({
  id: event.id,
  type: event.type,
  fromStatus: event.fromStatus,
  toStatus: event.toStatus,
  actorType: event.actorType,
  actorContext: event.actorContext,
  note: event.note,
  data: event.data,
  evidenceDocumentId: event.evidenceDocumentId,
  createdAt: event.createdAt.toISOString(),
});

export const visibleEvents = (events: SubmissionEvent[], audience: SubmissionAudience) => (audience === SubmissionAudience.Borrower ? events.filter((event) => event.type !== SubmissionEventType.note) : events).map(toSubmissionEventView);

export const toDocumentRequestView = (request: DocumentRequest, labels: Map<string, { label: unknown }>, locale: Locale) => ({
  id: request.id,
  applicationId: request.applicationId,
  submissionId: request.submissionId,
  status: request.status,
  documentTypes: request.documentTypes.map((key) => ({ key, label: localise(labels.get(key)?.label ?? { en: key }, locale) || key })),
  note: request.note,
  requestedContext: request.requestedContext,
  dueAt: iso(request.dueAt),
  fulfilledDocumentIds: request.fulfilledDocumentIds,
  fulfilledAt: iso(request.fulfilledAt),
  cancelledAt: iso(request.cancelledAt),
  createdAt: request.createdAt.toISOString(),
});
