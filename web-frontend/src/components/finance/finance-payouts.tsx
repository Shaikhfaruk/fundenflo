'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { KeyValues } from '@/components/data/detail-section';
import { DetailSheet } from '@/components/data/detail-sheet';
import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { approvePayout, financeKeys, markPayoutPaid, payoutQuery, payoutsQuery, reversePayout } from '@/lib/api/finance';
import type { Payout } from '@/lib/api/types/finance.types';
import { FINANCE_NOTE_MAX_LENGTH, FINANCE_NOTE_MIN_LENGTH, PAYOUT_STATUSES, PayoutStatus, UTR_PATTERN } from '@/lib/constants/admin.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate, formatDateTime, todayIsoDate } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

import { usePartyNames } from './use-party-names';

const BPS_PER_PERCENT = 100;

const REVERSIBLE: readonly string[] = [PayoutStatus.Pending, PayoutStatus.Approved, PayoutStatus.Paid];

type Dialog = 'approve' | 'paid' | 'reverse';

function PayoutSheet({ row, onClose }: { row: Payout; onClose: () => void }) {
  const t = useTranslations('finance.payouts');
  const locale = useLocale();
  const names = usePartyNames();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const utrId = useId();
  const dateId = useId();
  const fresh = useQuery(payoutQuery(row.id));
  const payout = fresh.data ?? row;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [today] = useState(todayIsoDate);
  const [utr, setUtr] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const done = (next: Payout) => {
    queryClient.setQueryData(financeKeys.payout(payout.id), next);
    void queryClient.invalidateQueries({ queryKey: financeKeys.all });
    toast.success(t('updated'));
    setDialog(null);
  };
  const options = { meta: { handlesError: true }, onSuccess: done, onError: (failure: Error) => errorToast(failure) };
  const approve = useMutation({ ...options, mutationFn: () => approvePayout(payout.id, payout.version) });
  const paid = useMutation({ ...options, mutationFn: () => markPayoutPaid(payout.id, { utr, paidOn }, payout.version) });
  const reverse = useMutation({ ...options, mutationFn: (reason: string) => reversePayout(payout.id, reason, payout.version) });
  return (
    <DetailSheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={payout.ref}
      description={names.partner(payout.partnerOrganizationId)}
      footer={
        <>
          {payout.status === PayoutStatus.Pending ? <Button size="sm" onClick={() => setDialog('approve')}>{t('approve')}</Button> : null}
          {payout.status === PayoutStatus.Approved ? <Button size="sm" onClick={() => setDialog('paid')}>{t('markPaid')}</Button> : null}
          {REVERSIBLE.includes(payout.status) ? (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDialog('reverse')}>
              {t('reverse')}
            </Button>
          ) : null}
        </>
      }
    >
      <KeyValues
        columns={1}
        items={[
          { label: t('status'), value: <StatusBadge status={payout.status} tone={toneOf(REVIEW_STATUS_TONE, payout.status)} /> },
          { label: t('receivable'), value: `${payout.receivable.ref} · ${payout.receivable.status}` },
          { label: t('base'), value: formatPaise(payout.basePaise, locale) },
          { label: t('gross'), value: formatPaise(payout.grossPaise, locale) },
          { label: t('tds', { rate: payout.tdsRateBps / BPS_PER_PERCENT }), value: formatPaise(payout.tdsPaise, locale) },
          { label: t('net'), value: <span className="font-semibold">{formatPaise(payout.netPaise, locale)}</span> },
          { label: t('approvedAt'), value: formatDateTime(payout.approvedAt, locale) },
          { label: t('paidAt'), value: formatDateTime(payout.paidAt, locale) },
          { label: t('utr'), value: payout.utr ?? '—' },
          { label: t('reverseReason'), value: payout.reverseReason ?? '—' },
        ]}
      />
      <p className="text-xs text-muted-foreground">{t('fourEyes')}</p>
      <ConfirmDialog open={dialog === 'approve'} onOpenChange={(open) => setDialog(open ? 'approve' : null)} title={t('approveTitle')} description={t('approveBody', { amount: formatPaise(payout.netPaise, locale) })} confirmLabel={t('approve')} pending={approve.isPending} onConfirm={() => approve.mutate()} />
      <ConfirmDialog open={dialog === 'paid'} onOpenChange={(open) => setDialog(open ? 'paid' : null)} title={t('paidTitle')} confirmLabel={t('markPaid')} pending={paid.isPending} confirmDisabled={!UTR_PATTERN.test(utr)} onConfirm={() => paid.mutate()}>
        <Field>
          <FieldLabel htmlFor={utrId}>{t('utr')}</FieldLabel>
          <Input id={utrId} value={utr} maxLength={30} onChange={(event) => setUtr(event.target.value.trim())} />
          <FieldDescription>{t('utrHint')}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={dateId}>{t('paidOn')}</FieldLabel>
          <Input id={dateId} type="date" max={today} value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
        </Field>
      </ConfirmDialog>
      <ReasonDialog open={dialog === 'reverse'} onOpenChange={(open) => setDialog(open ? 'reverse' : null)} title={t('reverseTitle')} description={t('reverseBody')} label={t('reason')} confirmLabel={t('reverse')} destructive pending={reverse.isPending} minLength={FINANCE_NOTE_MIN_LENGTH} maxLength={FINANCE_NOTE_MAX_LENGTH} onConfirm={(reason) => reverse.mutate(reason)} />
    </DetailSheet>
  );
}

export function FinancePayouts() {
  const t = useTranslations('finance.payouts');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const names = usePartyNames();
  const [status, setStatus] = useState<string>(ANY_VALUE);
  const [opened, setOpened] = useState<Payout | null>(null);
  const payouts = useInfiniteQuery(payoutsQuery(anyToUndefined(status)));
  const title = (row: Payout) => (
    <button type="button" onClick={() => setOpened(row)} className="truncate text-left font-semibold text-navy tabular hover:underline">
      {row.ref}
    </button>
  );
  const columns: Column<Payout>[] = [
    { key: 'ref', header: t('ref'), cell: title, hideOnCard: true },
    { key: 'partner', header: t('partner'), cell: (row) => names.partner(row.partnerOrganizationId) },
    { key: 'gross', header: t('gross'), cell: (row) => <span className="tabular">{formatPaise(row.grossPaise, locale)}</span>, className: 'text-right' },
    { key: 'net', header: t('net'), cell: (row) => <span className="tabular">{formatPaise(row.netPaise, locale)}</span>, className: 'text-right' },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} /> },
    { key: 'created', header: t('created'), cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt, locale)}</span>, className: 'hidden xl:table-cell' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void payouts.refetch()} refreshing={payouts.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={PAYOUT_STATUSES} label={t('status')} allLabel={t('anyStatus')} labelOf={(value) => enumLabel('payoutStatus', value)} />
      </FilterBar>
      <PagedList result={payouts} columns={columns} rowKey={(row) => row.id} title={title} empty={<EmptyState icon="payments" title={t('emptyTitle')} body={t('emptyBody')} />} />
      {opened ? <PayoutSheet key={opened.id} row={opened} onClose={() => setOpened(null)} /> : null}
    </div>
  );
}
