'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/data/empty-state';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import type { Column } from '@/components/data/responsive-list';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { useErrorToast } from '@/hooks/use-error-toast';
import { Link } from '@/i18n/navigation';
import { opsPartyKeys, partyMergesQuery, revertMerge } from '@/lib/api/ops-parties';
import type { PartyMerge } from '@/lib/api/types/ops.types';
import { LEAD_NOTE_MAX_LENGTH, PARTY_REASON_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { formatDateTime } from '@/lib/format/date';

export function OpsMerges() {
  const t = useTranslations('ops.merges');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [reverting, setReverting] = useState<PartyMerge | null>(null);
  const merges = useInfiniteQuery(partyMergesQuery());
  const revert = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => revertMerge(id, reason),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('revertedToast'));
      setReverting(null);
      void queryClient.invalidateQueries({ queryKey: opsPartyKeys.all });
    },
    onError: (failure) => errorToast(failure),
  });
  const columns: Column<PartyMerge>[] = [
    {
      key: 'parties',
      header: t('parties'),
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5 text-sm">
          <Link href={RoutePath.opsParty(row.sourcePartyId)} className="font-semibold text-gold-deep hover:underline">
            {t('merged')}
          </Link>
          →
          <Link href={RoutePath.opsParty(row.targetPartyId)} className="font-semibold text-gold-deep hover:underline">
            {t('kept')}
          </Link>
        </span>
      ),
      hideOnCard: true,
    },
    { key: 'reason', header: t('reason'), cell: (row) => <span className="line-clamp-2 text-[13px]">{row.reason}</span> },
    { key: 'when', header: t('when'), cell: (row) => formatDateTime(row.mergedAt, locale) },
    { key: 'reverted', header: t('reverted'), cell: (row) => (row.revertedAt ? formatDateTime(row.revertedAt, locale) : '—') },
    { key: 'actions', header: '', cell: (row) => (row.revertedAt ? null : <Button size="xs" variant="outline" onClick={() => setReverting(row)}>{t('undo')}</Button>), className: 'text-right' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void merges.refetch()} refreshing={merges.isFetching}>
        <span className="text-sm text-muted-foreground">{t('hint')}</span>
      </FilterBar>
      <PagedList result={merges} columns={columns} rowKey={(row) => row.id} title={(row) => <span className="text-sm">{row.reason}</span>} empty={<EmptyState icon="history" title={t('emptyTitle')} body={t('emptyBody')} />} />
      <ReasonDialog open={reverting !== null} onOpenChange={(open) => (open ? null : setReverting(null))} title={t('undoTitle')} description={t('undoBody')} label={t('reason')} confirmLabel={t('undo')} destructive pending={revert.isPending} minLength={PARTY_REASON_MIN_LENGTH} maxLength={LEAD_NOTE_MAX_LENGTH} onConfirm={(reason) => (reverting ? revert.mutate({ id: reverting.id, reason }) : null)} />
    </div>
  );
}
