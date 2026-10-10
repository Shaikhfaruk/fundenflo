import { queryOptions } from '@tanstack/react-query';

import { adminKeys } from './admin';
import { apiRequest } from './client';
import { pagedQuery } from './paged';
import type { Payout, Receivable, ReceivableAction, ReconciliationLine, ReconciliationRun, TrialBalance } from './types/finance.types';

export const financeKeys = {
  all: [...adminKeys.all, 'finance'] as const,
  receivables: (status: string | undefined) => [...financeKeys.all, 'receivables', status ?? 'any'] as const,
  receivable: (id: string) => [...financeKeys.all, 'receivables', 'detail', id] as const,
  payouts: (status: string | undefined) => [...financeKeys.all, 'payouts', status ?? 'any'] as const,
  payout: (id: string) => [...financeKeys.all, 'payouts', 'detail', id] as const,
  runs: () => [...financeKeys.all, 'reconciliation'] as const,
  trialBalance: () => [...financeKeys.all, 'trial-balance'] as const,
};

export const receivablesQuery = (status?: string) => pagedQuery<Receivable>(financeKeys.receivables(status), 'GET /admin/finance/receivables', { status });

export const receivableQuery = (id: string) => queryOptions({ queryKey: financeKeys.receivable(id), queryFn: () => apiRequest<Receivable>('GET /admin/finance/receivables/:id', { params: { id } }) });

export const updateReceivable = (id: string, body: ReceivableAction, expectedVersion: number) => apiRequest<Receivable>('PATCH /admin/finance/receivables/:id', { params: { id }, body: { ...body, expectedVersion } });

export const payoutsQuery = (status?: string) => pagedQuery<Payout>(financeKeys.payouts(status), 'GET /admin/finance/payouts', { status });

export const payoutQuery = (id: string) => queryOptions({ queryKey: financeKeys.payout(id), queryFn: () => apiRequest<Payout>('GET /admin/finance/payouts/:id', { params: { id } }) });

export const approvePayout = (id: string, expectedVersion: number) => apiRequest<Payout>('POST /admin/finance/payouts/:id/approve', { params: { id }, body: { expectedVersion } });

export const markPayoutPaid = (id: string, body: { utr: string; paidOn?: string }, expectedVersion: number) => apiRequest<Payout>('POST /admin/finance/payouts/:id/mark-paid', { params: { id }, body: { ...body, expectedVersion } });

export const reversePayout = (id: string, reason: string, expectedVersion: number) => apiRequest<Payout>('POST /admin/finance/payouts/:id/reverse', { params: { id }, body: { reason, expectedVersion } });

export const reconciliationRunsQuery = () => pagedQuery<ReconciliationRun>(financeKeys.runs(), 'GET /admin/finance/reconciliation');

export const runReconciliation = (body: { source: string; lenderId?: string; lines: ReconciliationLine[] }) => apiRequest<ReconciliationRun>('POST /admin/finance/reconciliation', { body, idempotent: true });

export const trialBalanceQuery = () => queryOptions({ queryKey: financeKeys.trialBalance(), queryFn: () => apiRequest<TrialBalance>('GET /admin/finance/ledger/trial-balance') });
