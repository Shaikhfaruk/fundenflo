'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { SearchInput } from '@/components/data/search-input';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { opsCasesQuery } from '@/lib/api/ops-cases';
import type { OpsCase } from '@/lib/api/types/ops.types';
import { MIN_SEARCH_LENGTH } from '@/lib/constants/lead.constants';
import { APPLICATION_CHANNELS, CASE_STATUSES } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { APPLICATION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

export function OpsCases() {
  const t = useTranslations('ops.cases');
  const tStatus = useTranslations('status');
  const tJourney = useTranslations('journey');
  const channelLabel = useEnumLabel('channel');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ANY_VALUE);
  const [channel, setChannel] = useState(ANY_VALUE);
  const q = useDebouncedValue(search.trim());
  const cases = useInfiniteQuery(opsCasesQuery({ q: q.length >= MIN_SEARCH_LENGTH ? q : undefined, status: anyToUndefined(status), channel: anyToUndefined(channel) }));
  const columns: Column<OpsCase>[] = [
    {
      key: 'case',
      header: t('case'),
      cell: (row) => (
        <Link href={RoutePath.opsCase(row.id)} className="flex min-w-0 flex-col hover:underline">
          <span className="truncate font-semibold text-navy">{row.party.displayName ?? row.actingParty.displayName ?? row.ref}</span>
          <span className="truncate text-xs text-muted-foreground tabular">{row.ref}</span>
        </Link>
      ),
      hideOnCard: true,
    },
    { key: 'category', header: t('category'), cell: (row) => categoryLabel(row.categoryKey) || '—' },
    { key: 'amount', header: t('amount'), cell: (row) => <span className="tabular">{formatPaise(row.amountPaise, locale, true)}</span>, className: 'text-right' },
    { key: 'channel', header: t('channel'), cell: (row) => channelLabel(row.channel) },
    { key: 'stage', header: t('stage'), cell: (row) => (tJourney.has(row.journeyStage) ? tJourney(row.journeyStage) : row.journeyStage) },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(APPLICATION_STATUS_TONE, row.status)} /> },
    { key: 'updated', header: t('updated'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.updatedAt, locale)}</span>, className: 'hidden xl:table-cell' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void cases.refetch()} refreshing={cases.isFetching}>
        <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} aria-label={t('search')} className="w-full sm:flex-1" />
        <EnumSelect value={status} onChange={setStatus} values={CASE_STATUSES} label={t('status')} allLabel={t('allStatuses')} labelOf={(value) => tStatus(value)} />
        <EnumSelect value={channel} onChange={setChannel} values={APPLICATION_CHANNELS} label={t('channel')} allLabel={t('allChannels')} labelOf={channelLabel} className="sm:w-40" />
      </FilterBar>
      <PagedList
        result={cases}
        columns={columns}
        rowKey={(row) => row.id}
        title={(row) => (
          <Link href={RoutePath.opsCase(row.id)} className="flex flex-col">
            <span>{row.party.displayName ?? row.ref}</span>
            <span className="text-xs font-normal text-muted-foreground tabular">{row.ref}</span>
          </Link>
        )}
        empty={<EmptyState icon="folder" title={t('emptyTitle')} body={t('emptyBody')} />}
      />
    </div>
  );
}
