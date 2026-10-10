import type { IdKeyName } from './common.types';

export type LenderSubmission = {
  id: string;
  ref: string;
  applicationId: string;
  status: string;
  lender: IdKeyName;
  product: IdKeyName & { versionId: string };
  matchResultId: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  lenderReference: string | null;
  sanction: { amountPaise: number; rateBps: number | null; tenureMonths: number | null; sanctionedAt: string } | null;
  disbursal: { amountPaise: number; disbursedAt: string | null };
  rejection: { reason: string; note: string | null } | null;
  withdrawnReason: string | null;
  closedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
