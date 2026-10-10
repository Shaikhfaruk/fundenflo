'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

import { EmptyState } from '@/components/data/empty-state';
import { type Column, ResponsiveList } from '@/components/data/responsive-list';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { trialBalanceQuery } from '@/lib/api/finance';
import type { TrialBalance } from '@/lib/api/types/finance.types';
import { formatPaise } from '@/lib/format/money';
import { cn } from '@/lib/utils';

type Row = TrialBalance['items'][number];

export function FinanceLedger() {
  const t = useTranslations('finance.ledger');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const balance = useQuery(trialBalanceQuery());
  const money = (value: number) => <span className="tabular">{value === 0 ? '—' : formatPaise(value, locale)}</span>;
  const columns: Column<Row>[] = [
    { key: 'account', header: t('account'), cell: (row) => <span className="flex flex-col"><span className="font-semibold text-navy">{row.name ?? row.code}</span><span className="font-mono text-xs text-muted-foreground">{row.code}</span></span>, hideOnCard: true },
    { key: 'type', header: t('type'), cell: (row) => enumLabel('ledgerAccountType', row.type) },
    { key: 'debit', header: t('debit'), cell: (row) => money(row.debitPaise), className: 'text-right' },
    { key: 'credit', header: t('credit'), cell: (row) => money(row.creditPaise), className: 'text-right' },
    { key: 'balance', header: t('balance'), cell: (row) => money(row.balancePaise), className: 'text-right' },
  ];
  const data = balance.data;
  const balanced = data ? data.totals.debitPaise === data.totals.creditPaise : true;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button size="sm" variant="outline" onClick={() => void balance.refetch()} disabled={balance.isFetching}>
            <Icon name="refresh" size={16} />
            {t('refresh')}
          </Button>
        }
      />
      {data ? (
        <output className={cn('flex items-center gap-2 rounded-xl px-4 py-3 text-sm', balanced ? 'bg-success-soft text-success' : 'bg-error-soft text-destructive')}>
          <Icon name={balanced ? 'verified' : 'error'} size={18} />
          {balanced ? t('balanced', { amount: formatPaise(data.totals.debitPaise, locale) }) : t('unbalanced', { debit: formatPaise(data.totals.debitPaise, locale), credit: formatPaise(data.totals.creditPaise, locale) })}
        </output>
      ) : null}
      {balance.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <ResponsiveList rows={data?.items ?? []} columns={columns} rowKey={(row) => `${row.code}-${row.organizationId ?? 'house'}`} title={(row) => row.name ?? row.code} empty={<EmptyState icon="balance" title={t('emptyTitle')} body={t('emptyBody')} />} />
      )}
    </div>
  );
}
