'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { EmptyState } from '@/components/data/empty-state';
import { type Column, ResponsiveList } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from '@/i18n/navigation';
import { lenderSubmissionsQuery } from '@/lib/api/lender';
import type { LenderSubmission } from '@/lib/api/types/submission.types';
import { LENDER_INBOX_FILTERS } from '@/lib/constants/lender.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { SUBMISSION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

const ALL = 'all';

export function LenderInbox() {
  const t = useTranslations('lender.inbox');
  const tStatus = useTranslations('status');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [filter, setFilter] = useState<string>(ALL);
  const submissions = useInfiniteQuery(lenderSubmissionsQuery(filter === ALL ? undefined : filter));
  const rows = submissions.data?.pages.flatMap((page) => page.items) ?? [];
  const columns: Column<LenderSubmission>[] = [
    {
      key: 'ref',
      header: t('ref'),
      cell: (row) => (
        <Link href={RoutePath.lenderSubmission(row.id)} className="flex items-center gap-3 hover:underline">
          <span className="h-8 w-1 shrink-0 rounded-full bg-navy" aria-hidden="true" />
          <span className="font-semibold text-navy tabular">{row.ref}</span>
        </Link>
      ),
      hideOnCard: true,
    },
    { key: 'product', header: t('product'), cell: (row) => row.product.name },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(SUBMISSION_STATUS_TONE, row.status)} /> },
    { key: 'sent', header: t('sent'), cell: (row) => formatDate(row.sentAt, locale) },
    { key: 'amount', header: t('amount'), cell: (row) => <span className="font-heading font-semibold text-navy tabular">{row.sanction ? formatPaise(row.sanction.amountPaise, locale) : '—'}</span>, className: 'text-right' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <Tabs value={filter} onValueChange={(value) => setFilter(String(value))}>
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList variant="line">
            <TabsTrigger value={ALL}>{t('all')}</TabsTrigger>
            {LENDER_INBOX_FILTERS.map((status) => (
              <TabsTrigger key={status} value={status}>
                {tStatus(status)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      {submissions.isPending ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <ResponsiveList
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          title={(row) => (
            <Link href={RoutePath.lenderSubmission(row.id)} className="flex items-center justify-between gap-2">
              <span className="tabular">{row.ref}</span>
              <Icon name="chevron-right" size={18} className="text-muted-foreground" />
            </Link>
          )}
          empty={<EmptyState icon="inbox" title={t('emptyTitle')} body={t('empty')} />}
        />
      )}
      {submissions.hasNextPage ? (
        <Button variant="outline" size="sm" className="self-center" onClick={() => void submissions.fetchNextPage()} disabled={submissions.isFetchingNextPage}>
          {tCommon('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
