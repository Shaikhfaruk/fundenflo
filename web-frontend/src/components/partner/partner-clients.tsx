'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { EmptyState } from '@/components/data/empty-state';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { applicationsPageQuery, partyName } from '@/lib/api/applications';
import type { Application } from '@/lib/api/types/application.types';
import { JourneyMode } from '@/lib/constants/journey.constants';
import { CASE_STATUSES } from '@/lib/constants/ops.constants';
import { AppPath, JOURNEY_PATHS } from '@/lib/constants/routes.constants';
import { APPLICATION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

const PATHS = JOURNEY_PATHS[JourneyMode.Partner];

function ClientName({ row }: { row: Application }) {
  return (
    <Link href={PATHS.application(row.id)} className="flex min-w-0 flex-col hover:underline">
      <span className="truncate font-semibold text-navy">{partyName(row) ?? row.ref}</span>
      <span className="text-xs text-muted-foreground tabular">{row.ref}</span>
    </Link>
  );
}

export function PartnerClients() {
  const t = useTranslations('partner.clients');
  const tStatus = useTranslations('status');
  const tJourney = useTranslations('journey');
  const categoryLabel = useCategoryLabel();
  const locale = useLocale();
  const [status, setStatus] = useState<string>(ANY_VALUE);
  const applications = useInfiniteQuery(applicationsPageQuery({ status: anyToUndefined(status) }));
  const columns: Column<Application>[] = [
    { key: 'client', header: t('client'), cell: (row) => <ClientName row={row} />, hideOnCard: true },
    { key: 'category', header: t('category'), cell: (row) => categoryLabel(row.categoryKey) || '—' },
    { key: 'amount', header: t('amount'), cell: (row) => <span className="tabular">{row.amountPaise ? formatPaise(row.amountPaise, locale) : '—'}</span> },
    { key: 'stage', header: t('stage'), cell: (row) => (tJourney.has(row.journeyStage) ? tJourney(row.journeyStage) : row.journeyStage) },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(APPLICATION_STATUS_TONE, row.status)} /> },
    { key: 'updated', header: t('updated'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.updatedAt, locale)}</span>, className: 'hidden xl:table-cell' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <ButtonLink href={AppPath.PartnerNewClient} size="sm">
            <Icon name="add" size={16} />
            {t('add')}
          </ButtonLink>
        }
      />
      <FilterBar onRefresh={() => void applications.refetch()} refreshing={applications.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={CASE_STATUSES} label={t('status')} allLabel={t('allStatuses')} labelOf={(value) => (tStatus.has(value) ? tStatus(value) : value)} />
      </FilterBar>
      <PagedList result={applications} columns={columns} rowKey={(row) => row.id} title={(row) => <ClientName row={row} />} empty={<EmptyState icon="folder" title={t('emptyTitle')} body={t('emptyBody')} action={<ButtonLink href={AppPath.PartnerNewClient} size="sm">{t('add')}</ButtonLink>} />} />
    </div>
  );
}
