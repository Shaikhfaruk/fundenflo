'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/data/empty-state';
import { anyToUndefined, EnumSelect } from '@/components/data/enum-select';
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
import { disputesQuery, opsRiskKeys, resolveDispute } from '@/lib/api/ops-risk';
import type { AttributionDispute } from '@/lib/api/types/ops.types';
import { DISPUTE_OUTCOMES, DISPUTE_STATUSES, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate, formatRelative } from '@/lib/format/date';

export function OpsDisputes() {
  const t = useTranslations('ops.disputes');
  const statusLabel = useEnumLabel('reviewStatus');
  const outcomeLabel = useEnumLabel('disputeOutcome');
  const sourceLabel = useEnumLabel('disputeSource');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [status, setStatus] = useState<string>(DISPUTE_STATUSES[0]);
  const [resolving, setResolving] = useState<AttributionDispute | null>(null);
  const disputes = useInfiniteQuery(disputesQuery(anyToUndefined(status)));
  const resolve = useMutation({
    mutationFn: ({ dispute, outcome, note }: { dispute: AttributionDispute; outcome: string; note: string }) => resolveDispute(dispute.id, { outcome, note, expectedVersion: dispute.version }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('resolved'));
      setResolving(null);
      void queryClient.invalidateQueries({ queryKey: opsRiskKeys.all });
    },
    onError: (failure) => errorToast(failure),
  });
  const columns: Column<AttributionDispute>[] = [
    {
      key: 'lead',
      header: t('lead'),
      cell: (row) => (
        <Link href={RoutePath.opsLead(row.leadId)} className="flex flex-col hover:underline">
          <span className="font-semibold text-navy">{t('openLead')}</span>
          <span className="text-xs text-muted-foreground">{sourceLabel(row.source)}</span>
        </Link>
      ),
      hideOnCard: true,
    },
    { key: 'claim', header: t('claim'), cell: (row) => <span className="line-clamp-2 text-[13px]">{row.claimNote ?? '—'}</span> },
    { key: 'protected', header: t('protectedUntil'), cell: (row) => formatDate(row.attribution.protectedUntil, locale) },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.outcome ?? row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} namespace={row.outcome ? 'enums.disputeOutcome' : 'enums.reviewStatus'} /> },
    { key: 'opened', header: t('opened'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.createdAt, locale)}</span> },
    { key: 'actions', header: '', cell: (row) => (row.status === DISPUTE_STATUSES[0] ? <Button size="xs" onClick={() => setResolving(row)}>{t('resolve')}</Button> : null), className: 'text-right' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void disputes.refetch()} refreshing={disputes.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={DISPUTE_STATUSES} label={t('status')} allLabel={t('allStatuses')} labelOf={statusLabel} />
      </FilterBar>
      <PagedList result={disputes} columns={columns} rowKey={(row) => row.id} title={(row) => <span>{sourceLabel(row.source)}</span>} empty={<EmptyState icon="gavel" title={t('emptyTitle')} body={t('emptyBody')} />} />
      <ReasonDialog
        key={resolving?.id ?? 'none'}
        open={resolving !== null}
        onOpenChange={(open) => (open ? null : setResolving(null))}
        title={t('resolveTitle')}
        description={t('resolveBody')}
        label={t('note')}
        confirmLabel={t('resolve')}
        pending={resolve.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        options={DISPUTE_OUTCOMES.map((value) => ({ value, label: outcomeLabel(value) }))}
        optionsLabel={t('outcome')}
        onConfirm={(note, outcome) => (resolving && outcome ? resolve.mutate({ dispute: resolving, outcome, note }) : null)}
      />
    </div>
  );
}
