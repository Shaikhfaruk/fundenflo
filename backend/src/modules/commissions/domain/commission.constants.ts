import { LedgerAccountType } from '../../../common/enums/db.enums.js';

export const BPS_MAX = 10_000;

export const DEFAULT_GST_RATE_BPS = 1_800;

export const DEFAULT_TDS_RATE_BPS = 500;

export const DEFAULT_TDS_NO_PAN_RATE_BPS = 2_000;

export const SCHEME_SLABS_MAX = 20;

export const RECONCILIATION_LINES_MAX = 500;

export const FINANCE_NOTE_MAX_LENGTH = 500;

export const LedgerSource = {
  Receivable: 'receivable',
  Payout: 'partner_payout',
} as const;

export type LedgerAccountSpec = { code: string; name: string; type: LedgerAccountType; organizationId?: string | null };

export const LedgerAccounts = {
  revenue: { code: 'commission_revenue', name: 'Commission revenue', type: LedgerAccountType.revenue },
  gstOutput: { code: 'gst_output', name: 'GST output payable', type: LedgerAccountType.liability },
  expense: { code: 'partner_commission_expense', name: 'Partner commission expense', type: LedgerAccountType.expense },
  tdsPayable: { code: 'tds_payable', name: 'TDS payable', type: LedgerAccountType.liability },
  bank: { code: 'bank', name: 'Bank', type: LedgerAccountType.asset },
  lenderReceivable: (organizationId: string): LedgerAccountSpec => ({ code: `lender_receivable:${organizationId}`, name: 'Lender commission receivable', type: LedgerAccountType.asset, organizationId }),
  partnerPayable: (organizationId: string): LedgerAccountSpec => ({ code: `partner_payable:${organizationId}`, name: 'Partner commission payable', type: LedgerAccountType.liability, organizationId }),
} as const;

export const ReceivableAction = {
  Invoice: 'invoice',
  Receive: 'receive',
  Reconcile: 'reconcile',
  WriteOff: 'write_off',
} as const;

export type ReceivableAction = (typeof ReceivableAction)[keyof typeof ReceivableAction];

export const PayoutReverseReason = {
  ReceivableWrittenOff: 'receivable_written_off',
} as const;

export const UnmatchedReason = {
  NotFound: 'not_found',
  Closed: 'closed',
  OverPayment: 'over_payment',
} as const;

export const ReconciliationSource = {
  LenderStatement: 'lender_statement',
  BankStatement: 'bank_statement',
} as const;
