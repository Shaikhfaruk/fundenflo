'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { type Column, ResponsiveList } from '@/components/data/responsive-list';
import { SearchInput } from '@/components/data/search-input';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { opsLeadsQuery } from '@/lib/api/leads';
import type { OpsLead } from '@/lib/api/types/lead.types';
import { LEAD_CONSENT_STATUSES, LEAD_STATUSES, MIN_SEARCH_LENGTH } from '@/lib/constants/lead.constants';
import { LEAD_CONSENT_TONE, LEAD_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';

const ANY = 'any';

export function OpsLeads() {
  const t = useTranslations('ops.leads');
  const tStatus = useTranslations('status');
  const tSources = useTranslations('sources');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ANY);
  const [consent, setConsent] = useState<string>(ANY);
  const q = useDebouncedValue(search.trim());
  const leads = useInfiniteQuery(
    opsLeadsQuery({ q: q.length >= MIN_SEARCH_LENGTH ? q : undefined, status: status === ANY ? undefined : status, consentStatus: consent === ANY ? undefined : consent }),
  );
  const rows = leads.data?.pages.flatMap((page) => page.items) ?? [];
  const columns: Column<OpsLead>[] = [
    { key: 'ref', header: t('ref'), cell: (row) => <span className="font-medium tabular">{row.ref}</span>, hideOnCard: true },
    { key: 'name', header: t('name'), cell: (row) => <span className="flex flex-col"><span>{row.party?.displayName ?? '—'}</span>{row.business ? <span className="text-xs text-muted-foreground">{row.business.displayName}</span> : null}</span>, hideOnCard: true },
    { key: 'source', header: t('source'), cell: (row) => (tSources.has(row.source.kind) ? tSources(row.source.kind) : row.source.key) },
    { key: 'category', header: t('category'), cell: (row) => categoryLabel(row.categoryKey) || '—' },
    { key: 'amount', header: t('amount'), cell: (row) => <span className="tabular">{row.amount.text ?? '—'}</span> },
    { key: 'city', header: t('city'), cell: (row) => row.location.city?.name ?? row.location.state?.name ?? '—' },
    { key: 'quality', header: t('quality'), cell: (row) => <span className="tabular">{row.qualityScore ?? '—'}</span>, className: 'text-right' },
    { key: 'consent', header: t('consent'), cell: (row) => <StatusBadge status={row.consentStatus} tone={toneOf(LEAD_CONSENT_TONE, row.consentStatus)} /> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(LEAD_STATUS_TONE, row.status)} /> },
    { key: 'updated', header: t('updated'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.updatedAt, locale)}</span> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} description={t('description')} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} aria-label={t('search')} className="flex-1" />
        <Select value={status} onValueChange={(value) => setStatus(String(value))}>
          <SelectTrigger className="w-full sm:w-48" aria-label={t('status')}>
            <SelectValue>{(value: string) => (value === ANY ? t('allStatuses') : tStatus(value))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t('allStatuses')}</SelectItem>
            {LEAD_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {tStatus(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={consent} onValueChange={(value) => setConsent(String(value))}>
          <SelectTrigger className="w-full sm:w-44" aria-label={t('consent')}>
            <SelectValue>{(value: string) => (value === ANY ? t('anyConsent') : tStatus(value))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t('anyConsent')}</SelectItem>
            {LEAD_CONSENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {tStatus(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {leads.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <ResponsiveList
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          title={(row) => (
            <span className="flex flex-col">
              <span>{row.party?.displayName ?? row.ref}</span>
              <span className="text-xs font-normal text-muted-foreground tabular">{row.ref}{row.business ? ` · ${row.business.displayName}` : ''}</span>
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
      {leads.hasNextPage ? (
        <Button variant="outline" className="self-center" onClick={() => void leads.fetchNextPage()} disabled={leads.isFetchingNextPage}>
          {tCommon('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
