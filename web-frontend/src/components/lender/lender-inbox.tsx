'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { type Column, ResponsiveList } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { lenderSubmissionsQuery } from '@/lib/api/lender';
import type { LenderSubmission } from '@/lib/api/types/submission.types';
import { LENDER_INBOX_FILTERS } from '@/lib/constants/lender.constants';
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
    { key: 'ref', header: t('ref'), cell: (row) => <span className="font-medium tabular">{row.ref}</span>, hideOnCard: true },
    { key: 'product', header: t('product'), cell: (row) => row.product.name },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(SUBMISSION_STATUS_TONE, row.status)} /> },
    { key: 'sent', header: t('sent'), cell: (row) => formatDate(row.sentAt, locale) },
    { key: 'amount', header: t('amount'), cell: (row) => (row.sanction ? formatPaise(row.sanction.amountPaise, locale) : '—'), className: 'text-right' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} description={t('description')} />
      <Tabs value={filter} onValueChange={(value) => setFilter(String(value))}>
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList>
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
            <span className="flex items-center justify-between gap-2">
              <span className="tabular">{row.ref}</span>
            </span>
          )}
          empty={
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyDescription>{t('empty')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      )}
      {submissions.hasNextPage ? (
        <Button variant="outline" className="self-center" onClick={() => void submissions.fetchNextPage()} disabled={submissions.isFetchingNextPage}>
          {tCommon('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
