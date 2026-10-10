'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { DetailSheet } from '@/components/data/detail-sheet';
import { KeyValues } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { completeDataRequest, dataRequestQuery, dataRequestsQuery, opsRiskKeys, rejectDataRequest } from '@/lib/api/ops-risk';
import type { DataRequest } from '@/lib/api/types/ops.types';
import { DATA_REQUEST_KINDS, DATA_REQUEST_STATUSES, DATA_REQUEST_TEXT_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { DATA_REQUEST_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate, formatDateTime } from '@/lib/format/date';

const OPEN: readonly string[] = ['received', 'in_progress'];

type Closing = 'complete' | 'reject';

function RequestSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations('ops.dataRequests');
  const kindLabel = useEnumLabel('dataRequestKind');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const request = useQuery(dataRequestQuery(id));
  const [closing, setClosing] = useState<Closing | null>(null);
  const close = useMutation({
    mutationFn: ({ kind, text }: { kind: Closing; text: string }) => (kind === 'complete' ? completeDataRequest(id, text) : rejectDataRequest(id, text)),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('saved'));
      setClosing(null);
      void queryClient.invalidateQueries({ queryKey: opsRiskKeys.all });
      onClose();
    },
    onError: (failure) => errorToast(failure),
  });
  const data = request.data;
  return (
    <DetailSheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={data ? `${data.ref} · ${kindLabel(data.kind)}` : t('title')}
      footer={
        data && OPEN.includes(data.status) ? (
          <>
            <Button onClick={() => setClosing('complete')}>{t('complete')}</Button>
            <Button variant="destructive" onClick={() => setClosing('reject')}>
              {t('reject')}
            </Button>
          </>
        ) : null
      }
    >
      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <KeyValues
            columns={1}
            items={[
              { label: t('status'), value: <StatusBadge status={data.status} tone={toneOf(DATA_REQUEST_STATUS_TONE, data.status)} /> },
              { label: t('received'), value: formatDateTime(data.createdAt, locale) },
              { label: t('due'), value: formatDate(data.dueAt, locale) },
              { label: t('details'), value: data.details ?? '—' },
              { label: t('party'), value: <Link href={RoutePath.opsParty(data.partyId)} className="font-semibold text-gold-deep hover:underline">{t('openParty')}</Link> },
              { label: t('response'), value: data.response ?? data.rejectedReason ?? '—' },
              { label: t('export'), value: data.exportReady ? t('exportReady', { date: formatDate(data.exportExpiresAt, locale) }) : '—' },
            ]}
          />
          {(data.holds ?? []).length > 0 ? (
            <div className="flex flex-col gap-1 rounded-lg bg-gold-soft p-3 text-[13px] text-[#5d4200]">
              <span className="font-semibold">{t('holds')}</span>
              {(data.holds ?? []).map((hold, index) => (
                <span key={`${hold.kind ?? 'hold'}-${index}`}>{hold.reason ?? hold.kind ?? JSON.stringify(hold)}</span>
              ))}
            </div>
          ) : null}
        </>
      )}
      <ReasonDialog
        key={closing ?? 'none'}
        open={closing !== null}
        onOpenChange={(open) => (open ? null : setClosing(null))}
        title={closing === 'reject' ? t('rejectTitle') : t('completeTitle')}
        description={closing === 'reject' ? t('rejectBody') : t('completeBody')}
        label={closing === 'reject' ? t('rejectReason') : t('responseLabel')}
        confirmLabel={closing === 'reject' ? t('reject') : t('complete')}
        destructive={closing === 'reject'}
        pending={close.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={DATA_REQUEST_TEXT_MAX_LENGTH}
        onConfirm={(text) => (closing ? close.mutate({ kind: closing, text }) : null)}
      />
    </DetailSheet>
  );
}

export function OpsDataRequests() {
  const t = useTranslations('ops.dataRequests');
  const tStatus = useTranslations('status');
  const kindLabel = useEnumLabel('dataRequestKind');
  const locale = useLocale();
  const [status, setStatus] = useState('received');
  const [kind, setKind] = useState('any');
  const [open, setOpen] = useState<string | null>(null);
  const requests = useInfiniteQuery(dataRequestsQuery({ status: anyToUndefined(status), kind: anyToUndefined(kind) }));
  const columns: Column<DataRequest>[] = [
    { key: 'ref', header: t('request'), cell: (row) => <span className="font-semibold text-navy tabular">{row.ref}</span>, hideOnCard: true },
    { key: 'kind', header: t('kind'), cell: (row) => kindLabel(row.kind) },
    { key: 'due', header: t('due'), cell: (row) => formatDate(row.dueAt, locale) },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(DATA_REQUEST_STATUS_TONE, row.status)} /> },
    { key: 'open', header: '', cell: (row) => <Button size="xs" variant="outline" onClick={() => setOpen(row.id)}>{t('open')}</Button>, className: 'text-right' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void requests.refetch()} refreshing={requests.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={DATA_REQUEST_STATUSES} label={t('status')} allLabel={t('allStatuses')} labelOf={(value) => tStatus(value)} />
        <EnumSelect value={kind} onChange={setKind} values={DATA_REQUEST_KINDS} label={t('kind')} allLabel={t('allKinds')} labelOf={kindLabel} className="sm:w-40" />
      </FilterBar>
      <PagedList result={requests} columns={columns} rowKey={(row) => row.id} title={(row) => <span className="tabular">{row.ref}</span>} empty={<EmptyState icon="privacy" title={t('emptyTitle')} body={t('emptyBody')} />} />
      {open ? <RequestSheet key={open} id={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
