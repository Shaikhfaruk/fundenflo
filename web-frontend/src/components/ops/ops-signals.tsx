'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { attributesQuery } from '@/lib/api/ops-cases';
import { consistencySignalsQuery, opsRiskKeys, resolveConsistencySignal } from '@/lib/api/ops-risk';
import type { ConsistencySignal } from '@/lib/api/types/ops.types';
import { CONSISTENCY_STATUSES, ConsistencyResolution, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, SEVERITY_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';
import { formatFactValue } from '@/lib/format/fact';
import { pickText } from '@/lib/format/localised';

type Resolving = { signal: ConsistencySignal; status: (typeof ConsistencyResolution)[keyof typeof ConsistencyResolution] };

export function OpsSignals() {
  const t = useTranslations('ops.signals');
  const tCommon = useTranslations('common');
  const statusLabel = useEnumLabel('reviewStatus');
  const severityLabel = useEnumLabel('severity');
  const provenanceLabel = useEnumLabel('provenance');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [status, setStatus] = useState<string>(CONSISTENCY_STATUSES[0]);
  const [resolving, setResolving] = useState<Resolving | null>(null);
  const signals = useInfiniteQuery(consistencySignalsQuery(anyToUndefined(status)));
  const attributes = useQuery(attributesQuery());
  const attributeOf = (key: string) => attributes.data?.items.find((item) => item.key === key);
  const yesNo = { yes: tCommon('yes'), no: tCommon('no') };
  const resolve = useMutation({
    mutationFn: ({ id, next, note }: { id: string; next: string; note: string }) => resolveConsistencySignal(id, { status: next, note }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('saved'));
      setResolving(null);
      void queryClient.invalidateQueries({ queryKey: opsRiskKeys.all });
    },
    onError: (failure) => errorToast(failure),
  });
  const columns: Column<ConsistencySignal>[] = [
    {
      key: 'attribute',
      header: t('attribute'),
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-navy">{pickText(attributeOf(row.attributeKey)?.label, locale) || row.attributeKey}</span>
          <span className="flex gap-2 text-xs">
            <Link href={RoutePath.opsParty(row.partyId)} className="text-gold-deep hover:underline">
              {t('party')}
            </Link>
            {row.applicationId ? (
              <Link href={RoutePath.opsCase(row.applicationId)} className="text-gold-deep hover:underline">
                {t('case')}
              </Link>
            ) : null}
          </span>
        </span>
      ),
      hideOnCard: true,
    },
    { key: 'declared', header: t('declared'), cell: (row) => <span className="tabular">{formatFactValue(row.declaredValue, attributeOf(row.attributeKey), locale, yesNo)}</span> },
    { key: 'observed', header: t('observed'), cell: (row) => <span className="tabular">{`${formatFactValue(row.observedValue, attributeOf(row.attributeKey), locale, yesNo)} · ${provenanceLabel(row.observedProvenance)}`}</span> },
    { key: 'gap', header: t('gap'), cell: (row) => <span className="tabular">{row.deviationPct === null ? '—' : `${row.deviationPct}%`}</span>, className: 'text-right' },
    { key: 'severity', header: t('severity'), cell: (row) => <StatusBadge status={row.severity} tone={toneOf(SEVERITY_TONE, row.severity)} namespace="enums.severity" /> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} namespace="enums.reviewStatus" /> },
    { key: 'raised', header: t('raised'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.createdAt, locale)}</span>, className: 'hidden xl:table-cell' },
    {
      key: 'actions',
      header: '',
      cell: (row) =>
        row.status === CONSISTENCY_STATUSES[0] ? (
          <span className="flex justify-end gap-1.5">
            <Button size="xs" onClick={() => setResolving({ signal: row, status: ConsistencyResolution.Resolved })}>
              {t('resolve')}
            </Button>
            <Button size="xs" variant="outline" onClick={() => setResolving({ signal: row, status: ConsistencyResolution.Dismissed })}>
              {t('dismiss')}
            </Button>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{row.resolutionNote}</span>
        ),
      className: 'text-right',
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void signals.refetch()} refreshing={signals.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={CONSISTENCY_STATUSES} label={t('status')} allLabel={t('allStatuses')} labelOf={statusLabel} />
      </FilterBar>
      <PagedList result={signals} columns={columns} rowKey={(row) => row.id} title={(row) => columns[0]?.cell(row)} empty={<EmptyState icon="sync-alt" title={t('emptyTitle')} body={status === ANY_VALUE ? t('emptyAll') : t('emptyBody')} />} />
      <ReasonDialog
        key={resolving ? `${resolving.signal.id}-${resolving.status}` : 'none'}
        open={resolving !== null}
        onOpenChange={(open) => (open ? null : setResolving(null))}
        title={resolving?.status === ConsistencyResolution.Dismissed ? t('dismissTitle') : t('resolveTitle')}
        description={resolving ? t('resolveBody', { severity: severityLabel(resolving.signal.severity) }) : undefined}
        label={t('note')}
        confirmLabel={resolving?.status === ConsistencyResolution.Dismissed ? t('dismiss') : t('resolve')}
        pending={resolve.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        onConfirm={(note) => (resolving ? resolve.mutate({ id: resolving.signal.id, next: resolving.status, note }) : null)}
      />
    </div>
  );
}
