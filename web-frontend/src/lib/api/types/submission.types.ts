import type { DocumentRequest, DocumentView } from './document.types';

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

type PacketFact = { attributeKey: string; value: unknown; provenance: string; observedAt: string; stale: boolean };

type SubmissionPacket = {
  application: { ref: string; segment: string; subSegment: string | null; category: string; purpose: string | null; purposeNote: string | null; amountPaise: number | null; tenureMonths: number | null };
  borrower: { name: string | null; facts: PacketFact[] };
  applicant: { name: string | null; facts: PacketFact[] } | null;
  coParties: Array<{ name: string | null; role: string; facts: PacketFact[] }>;
  assessment: { id: string; status: string; value: number | null; band: Record<string, string> | null; computedAt: string } | null;
  match: { outcome: string; fit: number; rank: number; reasons: Array<Record<string, string>> } | null;
  documents: Array<{ id: string; documentType: string; fileName: string; uploadedAt: string }>;
};

export type SubmissionFile = SubmissionDetail & {
  packet: { id: string; hash: string; createdAt: string; content: SubmissionPacket } | null;
  documents: DocumentView[];
  attributeLabels: Record<string, string>;
};
