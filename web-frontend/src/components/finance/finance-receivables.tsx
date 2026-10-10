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
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { financeKeys, receivableQuery, receivablesQuery, updateReceivable } from '@/lib/api/finance';
import type { Receivable, ReceivableAction as ReceivableActionBody } from '@/lib/api/types/finance.types';
import { FINANCE_NOTE_MAX_LENGTH, FINANCE_NOTE_MIN_LENGTH, RECEIVABLE_STATUSES, ReceivableAction, ReceivableStatus, UTR_PATTERN } from '@/lib/constants/admin.constants';
import { REVIEW_STATUS_TONE, StatusTone, toneOf } from '@/lib/constants/status.constants';
import { formatDate, formatDateTime, todayIsoDate } from '@/lib/format/date';
import { formatPaise, paiseFromRupees, rupeesFromPaiseValue } from '@/lib/format/money';

import { usePartyNames } from './use-party-names';

const TONE = { ...REVIEW_STATUS_TONE, accrued: StatusTone.Warning, invoiced: StatusTone.Info, received: StatusTone.Success, reconciled: StatusTone.Success, written_off: StatusTone.Neutral };

const OPEN: readonly string[] = [ReceivableStatus.Accrued, ReceivableStatus.Invoiced, ReceivableStatus.Received];

const BPS_PER_PERCENT = 100;

type Dialog = 'invoice' | 'receive' | 'reconcile' | 'write_off';

function ReceivableSheet({ row, onClose }: { row: Receivable; onClose: () => void }) {
  const t = useTranslations('finance.receivables');
  const locale = useLocale();
  const names = usePartyNames();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const invoiceId = useId();
  const onId = useId();
  const amountId = useId();
  const utrId = useId();
  const fresh = useQuery(receivableQuery(row.id));
  const receivable = fresh.data ?? row;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [today] = useState(todayIsoDate);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [on, setOn] = useState(today);
  const [amount, setAmount] = useState(String(rupeesFromPaiseValue(receivable.outstandingPaise)));
  const [utr, setUtr] = useState('');
  const act = useMutation({
    mutationFn: (body: ReceivableActionBody) => updateReceivable(receivable.id, body, receivable.version),
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(financeKeys.receivable(receivable.id), next);
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success(t('updated'));
      setDialog(null);
    },
    onError: (failure) => errorToast(failure),
  });
  const amountValue = Number(amount);
  const status = receivable.status;
  return (
    <DetailSheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={receivable.ref}
      description={names.lender(receivable.lenderId)}
      footer={
        <>
          {status === ReceivableStatus.Accrued ? <Button size="sm" onClick={() => setDialog('invoice')}>{t('invoice')}</Button> : null}
          {status === ReceivableStatus.Invoiced ? <Button size="sm" onClick={() => setDialog('receive')}>{t('receive')}</Button> : null}
          {status === ReceivableStatus.Received ? <Button size="sm" onClick={() => setDialog('reconcile')}>{t('reconcile')}</Button> : null}
          {OPEN.includes(status) ? (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDialog('write_off')}>
              {t('writeOff')}
            </Button>
          ) : null}
        </>
      }
    >
      <KeyValues
        columns={1}
        items={[
          { label: t('status'), value: <StatusBadge status={status} tone={toneOf(TONE, status)} namespace="enums.receivableStatus" /> },
          { label: t('base'), value: formatPaise(receivable.basePaise, locale) },
          { label: t('fee'), value: formatPaise(receivable.feePaise, locale) },
          { label: t('gst', { rate: receivable.gstRateBps / BPS_PER_PERCENT }), value: formatPaise(receivable.gstPaise, locale) },
          { label: t('total'), value: <span className="font-semibold">{formatPaise(receivable.totalPaise, locale)}</span> },
          { label: t('received'), value: formatPaise(receivable.receivedPaise, locale) },
          { label: t('outstanding'), value: formatPaise(receivable.outstandingPaise, locale) },
          { label: t('invoiceNumber'), value: receivable.invoiceNumber ?? '—' },
          { label: t('invoicedAt'), value: formatDateTime(receivable.invoicedAt, locale) },
          { label: t('utr'), value: receivable.utr ?? '—' },
          { label: t('reconciledAt'), value: formatDateTime(receivable.reconciledAt, locale) },
          { label: t('payout'), value: receivable.payout ? `${receivable.payout.ref} · ${formatPaise(receivable.payout.netPaise, locale)}` : '—' },
          { label: t('writeOffReason'), value: receivable.writeOffReason ?? '—' },
        ]}
      />
      <ConfirmDialog open={dialog === 'invoice'} onOpenChange={(open) => setDialog(open ? 'invoice' : null)} title={t('invoiceTitle')} confirmLabel={t('invoice')} pending={act.isPending} confirmDisabled={invoiceNumber.trim().length === 0} onConfirm={() => act.mutate({ action: ReceivableAction.Invoice, invoiceNumber: invoiceNumber.trim(), on })}>
        <Field>
          <FieldLabel htmlFor={invoiceId}>{t('invoiceNumber')}</FieldLabel>
          <Input id={invoiceId} value={invoiceNumber} maxLength={40} onChange={(event) => setInvoiceNumber(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={onId}>{t('date')}</FieldLabel>
          <Input id={onId} type="date" max={today} value={on} onChange={(event) => setOn(event.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'receive'} onOpenChange={(open) => setDialog(open ? 'receive' : null)} title={t('receiveTitle')} confirmLabel={t('receive')} pending={act.isPending} confirmDisabled={!(amountValue > 0) || (utr !== '' && !UTR_PATTERN.test(utr))} onConfirm={() => act.mutate({ action: ReceivableAction.Receive, amountPaise: paiseFromRupees(amountValue), utr: utr || undefined, on })}>
        <Field>
          <FieldLabel htmlFor={amountId}>{t('amountRupees')}</FieldLabel>
          <Input id={amountId} type="number" inputMode="decimal" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={utrId}>{t('utr')}</FieldLabel>
          <Input id={utrId} value={utr} maxLength={30} onChange={(event) => setUtr(event.target.value.trim())} />
        </Field>
        <Field>
          <FieldLabel htmlFor={onId}>{t('date')}</FieldLabel>
          <Input id={onId} type="date" max={today} value={on} onChange={(event) => setOn(event.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'reconcile'} onOpenChange={(open) => setDialog(open ? 'reconcile' : null)} title={t('reconcileTitle')} description={t('reconcileBody')} confirmLabel={t('reconcile')} pending={act.isPending} onConfirm={() => act.mutate({ action: ReceivableAction.Reconcile })} />
      <ReasonDialog open={dialog === 'write_off'} onOpenChange={(open) => setDialog(open ? 'write_off' : null)} title={t('writeOffTitle')} description={t('writeOffBody')} label={t('reason')} confirmLabel={t('writeOff')} destructive pending={act.isPending} minLength={FINANCE_NOTE_MIN_LENGTH} maxLength={FINANCE_NOTE_MAX_LENGTH} onConfirm={(reason) => act.mutate({ action: ReceivableAction.WriteOff, reason })} />
    </DetailSheet>
  );
}

export function FinanceReceivables() {
  const t = useTranslations('finance.receivables');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const names = usePartyNames();
  const [status, setStatus] = useState<string>(ANY_VALUE);
  const [opened, setOpened] = useState<Receivable | null>(null);
  const receivables = useInfiniteQuery(receivablesQuery(anyToUndefined(status)));
  const title = (row: Receivable) => (
    <button type="button" onClick={() => setOpened(row)} className="truncate text-left font-semibold text-navy tabular hover:underline">
      {row.ref}
    </button>
  );
  const columns: Column<Receivable>[] = [
    { key: 'ref', header: t('ref'), cell: title, hideOnCard: true },
    { key: 'lender', header: t('lender'), cell: (row) => names.lender(row.lenderId) },
    { key: 'total', header: t('total'), cell: (row) => <span className="tabular">{formatPaise(row.totalPaise, locale)}</span>, className: 'text-right' },
    { key: 'outstanding', header: t('outstanding'), cell: (row) => <span className="tabular">{formatPaise(row.outstandingPaise, locale)}</span>, className: 'text-right' },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(TONE, row.status)} namespace="enums.receivableStatus" /> },
    { key: 'created', header: t('created'), cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt, locale)}</span>, className: 'hidden xl:table-cell' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void receivables.refetch()} refreshing={receivables.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={RECEIVABLE_STATUSES} label={t('status')} allLabel={t('anyStatus')} labelOf={(value) => enumLabel('receivableStatus', value)} />
      </FilterBar>
      <PagedList result={receivables} columns={columns} rowKey={(row) => row.id} title={title} empty={<EmptyState icon="receipt-long" title={t('emptyTitle')} body={t('emptyBody')} />} />
      {opened ? <ReceivableSheet key={opened.id} row={opened} onClose={() => setOpened(null)} /> : null}
    </div>
  );
}
