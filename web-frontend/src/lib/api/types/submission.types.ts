import type { DocumentRequest } from './document.types';

export type LenderSubmission = {
  id: string;
  ref: string;
  applicationId: string;
  status: string;
  lender: { id: string; key: string | null; name: string | null };
  product: { id: string; key: string; versionId: string; name: string };
  matchResultId: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  lenderReference: string | null;
  sanction: { amountPaise: number; sanctionedAt: string | null; letterDocumentId: string | null } | null;
  disbursal: { amountPaise: number; disbursedAt: string | null };
  rejection: { reason: string; label: string; note?: string | null } | null;
  withdrawnReason: string | null;
  closedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionEvent = {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorType: string;
  actorContext: string | null;
  note: string | null;
  data: Record<string, unknown> | null;
  evidenceDocumentId: string | null;
  createdAt: string;
};

export type SubmissionDetail = LenderSubmission & { events: SubmissionEvent[]; documentRequests: DocumentRequest[] };
