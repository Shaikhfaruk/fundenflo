# Finance close

Commission schemes are versioned config (`/admin/commission-schemes`; finance makes, another person approves). Every disbursal tranche accrues a receivable from the lender (fee + GST) and, when a partner firm owns the case, a partner payout (gross − TDS). All money movements are double-entry journals.

## Monthly steps

1. **Check accruals**: `GET /admin/finance/receivables?status=accrued`. A disbursal without a receivable means no published scheme matched (audit `commission.unscheduled`); publish the scheme and re-add the `commissions.accrue` job.
2. **Invoice lenders**: `PATCH /admin/finance/receivables/:id` with `{ "action": "invoice", "invoiceNumber": "…" }`.
3. **Record receipts**: run the lender or bank statement through `POST /admin/finance/reconciliation` (lines matched by receivable ref or invoice number; fully paid receivables are reconciled). Work the `unmatched` lines by hand with `{ "action": "receive", "amountPaise": …, "utr": "…" }`.
4. **Approve payouts**: `GET /admin/finance/payouts?status=pending`, then `POST …/approve`. Approval needs the receivable collected, the firm's KYC verified (PAN + bank account), no disputed attribution and no fraud hold. TDS is recomputed with the firm's PAN status.
5. **Pay**: make the bank transfer from the account shown in `GET /admin/finance/payouts/:id` (every view is audited), then `POST …/mark-paid` with the UTR. A different person from the approver must mark it paid. The firm owner gets an email and SMS.
6. **Close**: `GET /admin/finance/ledger/trial-balance` must show equal debits and credits; lender receivable and partner payable balances must match the open receivables and approved payouts. Export TDS for the quarter's return from paid payouts (TDS returns are filed outside the system for now).

Write-offs (`{ "action": "write_off", "reason": "…" }`) are only possible before any receipt and reverse the unpaid payout.
