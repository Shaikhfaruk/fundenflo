'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { EmptyState } from '@/components/data/empty-state';
import { anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Link } from '@/i18n/navigation';
import { opsSubmissionsQuery } from '@/lib/api/ops-cases';
import type { OpsSubmission } from '@/lib/api/types/ops.types';
import { SUBMISSION_STATUSES } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { SUBMISSION_STATUS_TONE, SubmissionStatus, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

export function OpsSubmissions() {
  const t = useTranslations('ops.submissions');
  const tStatus = useTranslations('status');
  const locale = useLocale();
  const [status, setStatus] = useState<string>(SubmissionStatus.PendingApproval);
  const submissions = useInfiniteQuery(opsSubmissionsQuery({ status: anyToUndefined(status) }));
  const columns: Column<OpsSubmission>[] = [
    {
      key: 'submission',
      header: t('submission'),
      cell: (row) => (
        <Link href={RoutePath.opsSubmission(row.id)} className="flex min-w-0 flex-col hover:underline">
          <span className="truncate font-semibold text-navy">{row.lender.name ?? row.product.name}</span>
          <span className="truncate text-xs text-muted-foreground tabular">{row.ref}</span>
        </Link>
      ),
      hideOnCard: true,
    },
    { key: 'product', header: t('product'), cell: (row) => row.product.name },
    { key: 'sanction', header: t('sanction'), cell: (row) => <span className="tabular">{row.sanction ? formatPaise(row.sanction.amountPaise, locale, true) : '—'}</span>, className: 'text-right' },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(SUBMISSION_STATUS_TONE, row.status)} /> },
    { key: 'updated', header: t('updated'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.updatedAt, locale)}</span> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void submissions.refetch()} refreshing={submissions.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={SUBMISSION_STATUSES} label={t('status')} allLabel={t('allStatuses')} labelOf={(value) => tStatus(value)} className="sm:w-60" />
      </FilterBar>
      <PagedList
        result={submissions}
        columns={columns}
        rowKey={(row) => row.id}
        title={(row) => (
          <Link href={RoutePath.opsSubmission(row.id)} className="flex flex-col">
            <span>{row.lender.name ?? row.product.name}</span>
            <span className="text-xs font-normal text-muted-foreground tabular">{row.ref}</span>
          </Link>
        )}
        empty={<EmptyState icon="inbox" title={t('emptyTitle')} body={t('emptyBody')} />}
      />
    </div>
  );
}
