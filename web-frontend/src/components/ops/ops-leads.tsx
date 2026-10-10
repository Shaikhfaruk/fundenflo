'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { EmptyState } from '@/components/data/empty-state';
import { type Column, ResponsiveList } from '@/components/data/responsive-list';
import { SearchInput } from '@/components/data/search-input';
import { StatusBadge } from '@/components/data/status-badge';
import { BulkAssignDialog, MergeLeadsDialog, NewLeadDialog } from '@/components/ops/lead-bulk-dialogs';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useErrorToast } from '@/hooks/use-error-toast';
import { Link } from '@/i18n/navigation';
import { bulkRouteLeads, opsLeadKeys, opsLeadsQuery } from '@/lib/api/leads';
import type { OpsLead } from '@/lib/api/types/lead.types';
import { LEAD_CONSENT_STATUSES, LEAD_STATUSES, MIN_SEARCH_LENGTH } from '@/lib/constants/lead.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
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
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const route = useMutation({
    mutationFn: () => bulkRouteLeads(selected),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('bulkRouted', { count: selected.length }));
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
    },
    onError: (failure) => errorToast(failure),
  });
  const columns: Column<OpsLead>[] = [
    {
      key: 'select',
      header: '',
      cell: (row) => <Checkbox checked={selected.includes(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={t('select', { name: row.party?.displayName ?? row.ref })} />,
      className: 'w-10',
      hideOnCard: true,
    },
    {
      key: 'name',
      header: t('name'),
      cell: (row) => (
        <Link href={RoutePath.opsLead(row.id)} className="flex items-center gap-3 hover:underline">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle font-heading text-sm font-semibold text-navy">{(row.party?.displayName ?? row.ref).slice(0, 1).toUpperCase()}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{row.party?.displayName ?? '—'}</span>
            <span className="truncate text-xs text-muted-foreground tabular">{[row.ref, row.business?.displayName, row.location.city?.name ?? row.location.state?.name].filter(Boolean).join(' · ')}</span>
          </span>
        </Link>
      ),
      hideOnCard: true,
    },
    { key: 'source', header: t('source'), cell: (row) => <span className="rounded-xs bg-subtle px-2 py-1 text-[11px] font-semibold tracking-[0.04em] text-navy uppercase">{tSources.has(row.source.kind) ? tSources(row.source.kind) : row.source.key}</span> },
    { key: 'category', header: t('category'), cell: (row) => categoryLabel(row.categoryKey) || '—' },
    { key: 'amount', header: t('amount'), cell: (row) => <span className="tabular">{row.amount.text ?? '—'}</span> },
    {
      key: 'quality',
      header: t('quality'),
      cell: (row) =>
        row.qualityScore === null || row.qualityScore === undefined ? (
          '—'
        ) : (
          <span className="flex items-center justify-end gap-2">
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-subtle">
              <span className="block h-full rounded-full bg-gold-deep" style={{ width: `${Math.min(100, row.qualityScore)}%` }} />
            </span>
            <span className="font-semibold tabular">{row.qualityScore}</span>
          </span>
        ),
      className: 'text-right',
    },
    { key: 'consent', header: t('consent'), cell: (row) => <StatusBadge status={row.consentStatus} tone={toneOf(LEAD_CONSENT_TONE, row.consentStatus)} /> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(LEAD_STATUS_TONE, row.status)} /> },
    { key: 'updated', header: t('updated'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.updatedAt, locale)}</span>, className: 'hidden xl:table-cell' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        badge={leads.data ? <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold text-muted-foreground tabular">{t('loaded', { count: rows.length })}</span> : null}
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Icon name="add" size={16} />
            {t('newLead')}
          </Button>
        }
      />
      {selected.length > 0 ? (
        <section className="flex flex-wrap items-center gap-2 rounded-xl bg-navy p-3 text-white shadow-lift" aria-label={t('selection')}>
          <span className="text-sm font-semibold tabular">{t('selected', { count: selected.length })}</span>
          <span className="flex-1" />
          <Button size="xs" variant="hero" onClick={() => route.mutate()} disabled={route.isPending}>
            {t('routeSelected')}
          </Button>
          <Button size="xs" variant="hero" onClick={() => setAssignOpen(true)}>
            {t('assignSelected')}
          </Button>
          <Button size="xs" variant="hero" onClick={() => setMergeOpen(true)} disabled={selected.length < 2}>
            {t('mergeSelected')}
          </Button>
          <Button size="xs" variant="hero" onClick={() => setSelected([])}>
            {t('clear')}
          </Button>
        </section>
      ) : null}
      <div className="flex flex-col gap-2 rounded-2xl border border-[#eef2f6] bg-card p-3 shadow-card sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} aria-label={t('search')} className="w-full sm:flex-1" />
        <Select value={status} onValueChange={(value) => setStatus(String(value))}>
          <SelectTrigger size="sm" className="h-11 w-full sm:w-48" aria-label={t('status')}>
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
          <SelectTrigger size="sm" className="h-11 w-full sm:w-44" aria-label={t('consent')}>
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
        <Button variant="secondary" size="icon-lg" className="hidden shrink-0 rounded-lg sm:flex" aria-label={tCommon('refresh')} onClick={() => void leads.refetch()} disabled={leads.isFetching}>
          <Icon name="refresh" size={20} className={leads.isFetching ? 'animate-spin' : undefined} />
        </Button>
      </div>
      {leads.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <ResponsiveList
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          title={(row) => (
            <span className="flex items-start gap-3">
              <Checkbox checked={selected.includes(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={t('select', { name: row.party?.displayName ?? row.ref })} className="mt-1" />
              <Link href={RoutePath.opsLead(row.id)} className="flex flex-col">
                <span>{row.party?.displayName ?? row.ref}</span>
                <span className="text-xs font-normal text-muted-foreground tabular">{row.ref}{row.business ? ` · ${row.business.displayName}` : ''}</span>
              </Link>
            </span>
          )}
          empty={<EmptyState icon="inbox" title={t('emptyTitle')} body={t('empty')} />}
        />
      )}
      {leads.hasNextPage ? (
        <Button variant="outline" size="sm" className="self-center" onClick={() => void leads.fetchNextPage()} disabled={leads.isFetchingNextPage}>
          {tCommon('loadMore')}
        </Button>
      ) : null}
      <NewLeadDialog open={newOpen} onOpenChange={setNewOpen} />
      {assignOpen ? <BulkAssignDialog leadIds={selected} open={assignOpen} onOpenChange={setAssignOpen} onDone={() => { setAssignOpen(false); setSelected([]); }} /> : null}
      {mergeOpen ? <MergeLeadsDialog leads={rows.filter((row) => selected.includes(row.id))} open={mergeOpen} onOpenChange={setMergeOpen} onDone={() => { setMergeOpen(false); setSelected([]); }} /> : null}
    </div>
  );
}
