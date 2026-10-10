export type Receivable = {
  id: string;
  ref: string;
  status: string;
  lenderId: string;
  lenderOrganizationId: string;
  lenderName: string | null;
  submissionId: string | null;
  applicationId: string | null;
  basePaise: number;
  feePaise: number;
  gstRateBps: number;
  gstPaise: number;
  totalPaise: number;
  receivedPaise: number;
  outstandingPaise: number;
  invoiceNumber: string | null;
  invoicedAt: string | null;
  receivedAt: string | null;
  utr: string | null;
  reconciledAt: string | null;
  writtenOffAt: string | null;
  writeOffReason: string | null;
  payout: { id: string; ref: string; status: string; netPaise: number } | null;
  version: number;
  createdAt: string;
};

export type Payout = {
  id: string;
  ref: string;
  status: string;
  partnerOrganizationId: string;
  partnerName: string | null;
  receivable: { id: string; ref: string; status: string };
  submissionId: string | null;
  applicationId: string | null;
  basePaise: number;
  grossPaise: number;
  tdsRateBps: number;
  tdsPaise: number;
  netPaise: number;
  approvedAt: string | null;
  paidAt: string | null;
  utr: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
  approvedByUserId?: string | null;
  version: number;
  createdAt: string;
};

export type ReconciliationRun = {
  id: string;
  lenderOrganizationId: string | null;
  lenderName: string | null;
  source: string;
  lineCount: number;
  matchedCount: number;
  totalPaise: number;
  matchedPaise: number;
  unmatched: Array<{ utr?: string; reason: string; reference: string; amountPaise: number }>;
  createdAt: string;
};

export type ReconciliationLine = { reference: string; amountPaise: number; utr?: string; paidOn?: string };

export type TrialBalance = { items: Array<{ code: string; name: string | null; type: string | null; organizationId: string | null; debitPaise: number; creditPaise: number; balancePaise: number }>; totals: { debitPaise: number; creditPaise: number } };

export type ReceivableAction =
  | { action: 'invoice'; invoiceNumber: string; on?: string }
  | { action: 'receive'; amountPaise: number; utr?: string; on?: string }
  | { action: 'reconcile' }
  | { action: 'write_off'; reason: string };
