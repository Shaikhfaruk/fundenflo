'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { KeyValues, Section } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { StatCard } from '@/components/data/stat-card';
import { PageHeader } from '@/components/shell/page-header';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientValue } from '@/hooks/use-client-value';
import { usePartnerOwner } from '@/hooks/use-partner-owner';
import { commissionLedgerQuery, commissionStatementQuery, commissionSummaryQuery } from '@/lib/api/partners';
import type { LedgerEntry, PartnerPayout } from '@/lib/api/types/partner.types';
import { STATEMENT_MONTH_PATTERN } from '@/lib/constants/partner.constants';
import { formatDate, formatDateTime } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

const PAYOUT_STATUSES = ['pending', 'approved', 'paid', 'reversed'] as const;

const CARD_STEP = 0.05;

const thisMonth = () => new Date().toISOString().slice(0, 7);

function Statement({ month }: { month: string }) {
  const t = useTranslations('partner.commissions');
  const locale = useLocale();
  const statement = useQuery({ ...commissionStatementQuery(month), enabled: STATEMENT_MONTH_PATTERN.test(month) });
  if (statement.isPending) return <Skeleton className="h-32 w-full rounded-lg" />;
  const data = statement.data;
  if (!data) return <p className="text-sm text-muted-foreground">{t('statementUnavailable')}</p>;
  return (
    <div className="flex flex-col gap-3">
      <KeyValues
        columns={3}
        items={[
          { label: t('opening'), value: formatPaise(data.openingPayablePaise, locale) },
          { label: t('paidNet'), value: formatPaise(data.paid.netPaise, locale) },
          { label: t('closing'), value: formatPaise(data.closingPayablePaise, locale) },
          { label: t('paidGross'), value: formatPaise(data.paid.grossPaise, locale) },
          { label: t('tds'), value: formatPaise(data.paid.tdsPaise, locale) },
          { label: t('payouts'), value: String(data.paid.count) },
        ]}
      />
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noPayouts')}</p>
      ) : (
        <ul className="flex flex-col">
          {data.items.map((payout: PartnerPayout) => (
            <li key={payout.id} className="flex items-center justify-between gap-2 border-t border-subtle py-2.5 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-foreground tabular">{payout.ref}</span>
                <span className="text-xs text-muted-foreground">{t('paidOn', { date: formatDateTime(payout.paidAt, locale), utr: payout.utr ?? '—' })}</span>
              </span>
              <span className="font-heading font-semibold text-navy tabular">{formatPaise(payout.netPaise, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PartnerCommissions() {
  const t = useTranslations('partner.commissions');
  const tStatus = useTranslations('status');
  const locale = useLocale();
  const { owner } = usePartnerOwner();
  const summary = useQuery(commissionSummaryQuery());
  const ledger = useInfiniteQuery(commissionLedgerQuery());
  const currentMonth = useClientValue(thisMonth);
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? currentMonth;
  const money = (value: number) => formatPaise(value, locale);
  const columns: Column<LedgerEntry>[] = [
    { key: 'posted', header: t('posted'), cell: (row) => formatDate(row.postedAt, locale), hideOnCard: true },
    { key: 'memo', header: t('memo'), cell: (row) => row.memo ?? row.kind },
    { key: 'credit', header: t('credit'), cell: (row) => <span className="tabular text-success">{row.creditPaise > 0 ? money(row.creditPaise) : '—'}</span>, className: 'text-right' },
    { key: 'debit', header: t('debit'), cell: (row) => <span className="tabular">{row.debitPaise > 0 ? money(row.debitPaise) : '—'}</span>, className: 'text-right' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      {summary.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : summary.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label={t('payable')} value={summary.data.payablePaise} icon="payments" tone="gold" format={money} hint={t('payableHint')} />
          {PAYOUT_STATUSES.map((status, index) => (
            <StatCard key={status} label={tStatus(status)} value={summary.data.byStatus[status]?.netPaise ?? 0} icon={status === 'paid' ? 'check-circle' : status === 'reversed' ? 'error' : 'pending'} tone={status === 'paid' ? 'success' : status === 'reversed' ? 'danger' : 'navy'} format={money} hint={t('count', { count: summary.data.byStatus[status]?.count ?? 0 })} delay={CARD_STEP * (index + 1)} />
          ))}
        </div>
      ) : null}
      {owner ? (
        <Section title={t('statement')}>
          <Field className="max-w-48">
            <FieldLabel htmlFor="statement-month">{t('month')}</FieldLabel>
            <Input id="statement-month" type="month" value={month ?? ''} max={currentMonth ?? undefined} onChange={(event) => setPicked(event.target.value)} />
          </Field>
          {month ? <Statement month={month} /> : picked === '' ? <p className="text-sm text-muted-foreground">{t('statementUnavailable')}</p> : <Skeleton className="h-32 w-full rounded-lg" />}
        </Section>
      ) : null}
      <Section title={t('ledger')}>
        <PagedList result={ledger} columns={columns} rowKey={(row) => row.id} title={(row) => formatDate(row.postedAt, locale)} empty={<EmptyState icon="payments" title={t('emptyTitle')} body={t('emptyBody')} />} />
      </Section>
    </div>
  );
}
