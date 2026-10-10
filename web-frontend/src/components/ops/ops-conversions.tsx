'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { EmptyState } from '@/components/data/empty-state';
import { EnumSelect } from '@/components/data/enum-select';
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
import { conversionsQuery, decideConversion, opsLeadKeys } from '@/lib/api/leads';
import type { OfflineConversion } from '@/lib/api/types/lead.types';
import { CONVERSION_STATUSES, ConversionDecision, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

type Decision = { conversion: OfflineConversion; decision: (typeof ConversionDecision)[keyof typeof ConversionDecision] };

export function OpsConversions() {
  const t = useTranslations('ops.conversions');
  const statusLabel = useEnumLabel('conversionStatus');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [status, setStatus] = useState<string>(CONVERSION_STATUSES[0]);
  const [deciding, setDeciding] = useState<Decision | null>(null);
  const conversions = useInfiniteQuery(conversionsQuery(status));
  const decide = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note: string }) => decideConversion(id, { decision, ...(note ? { note } : {}) }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('decided'));
      setDeciding(null);
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
    },
    onError: (failure) => errorToast(failure),
  });
  const columns: Column<OfflineConversion>[] = [
    {
      key: 'lender',
      header: t('lender'),
      cell: (row) => (
        <Link href={RoutePath.opsLead(row.leadId)} className="flex min-w-0 flex-col hover:underline">
          <span className="truncate font-semibold text-navy">{row.lenderName}</span>
          <span className="truncate text-xs text-muted-foreground">{row.loanAccountRef ?? '—'}</span>
        </Link>
      ),
      hideOnCard: true,
    },
    { key: 'category', header: t('category'), cell: (row) => categoryLabel(row.categoryKey) || '—' },
    { key: 'sanctioned', header: t('sanctioned'), cell: (row) => <span className="tabular">{formatPaise(row.sanctionedAmountPaise, locale)}</span>, className: 'text-right' },
    { key: 'disbursed', header: t('disbursed'), cell: (row) => <span className="tabular">{row.disbursedAmountPaise === null ? '—' : formatPaise(row.disbursedAmountPaise, locale)}</span>, className: 'text-right' },
    { key: 'date', header: t('sanctionedOn'), cell: (row) => formatDate(row.sanctionedOn, locale) },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} /> },
    {
      key: 'actions',
      header: '',
      cell: (row) =>
        row.status === CONVERSION_STATUSES[0] ? (
          <span className="flex justify-end gap-1.5">
            <Button size="xs" onClick={() => setDeciding({ conversion: row, decision: ConversionDecision.Verify })}>
              {t('verify')}
            </Button>
            <Button size="xs" variant="destructive" onClick={() => setDeciding({ conversion: row, decision: ConversionDecision.Reject })}>
              {t('reject')}
            </Button>
          </span>
        ) : null,
      className: 'text-right',
    },
  ];
  const rejecting = deciding?.decision === ConversionDecision.Reject;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void conversions.refetch()} refreshing={conversions.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={CONVERSION_STATUSES} label={t('status')} labelOf={statusLabel} />
      </FilterBar>
      <PagedList result={conversions} columns={columns} rowKey={(row) => row.id} title={(row) => <span>{row.lenderName}</span>} empty={<EmptyState icon="payments" title={t('emptyTitle')} body={t('emptyBody')} />} />
      <ReasonDialog
        key={deciding ? `${deciding.conversion.id}-${deciding.decision}` : 'none'}
        open={deciding !== null}
        onOpenChange={(open) => (open ? null : setDeciding(null))}
        title={rejecting ? t('rejectTitle') : t('verifyTitle')}
        description={deciding ? t('decisionBody', { lender: deciding.conversion.lenderName, amount: formatPaise(deciding.conversion.sanctionedAmountPaise, locale) }) : undefined}
        label={rejecting ? t('rejectReason') : t('noteOptional')}
        confirmLabel={rejecting ? t('reject') : t('verify')}
        destructive={rejecting}
        pending={decide.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        noteOptional={!rejecting}
        onConfirm={(note) => (deciding ? decide.mutate({ id: deciding.conversion.id, decision: deciding.decision, note }) : null)}
      />
    </div>
  );
}
