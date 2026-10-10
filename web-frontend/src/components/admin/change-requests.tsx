'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { KeyValues, Section } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { adminConfigKeys, approveChangeRequest, changeRequestQuery, changeRequestsQuery, rejectChangeRequest } from '@/lib/api/admin-config';
import type { ChangeRequest } from '@/lib/api/types/admin-config.types';
import { CHANGE_REQUEST_STATUSES, ChangeRequestStatus, CONFIG_NOTE_MAX_LENGTH, CONFIG_NOTE_MIN_LENGTH, CONFIG_RESOURCE_META, type ConfigResource } from '@/lib/constants/admin.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { cn } from '@/lib/utils';

const shown = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));

const isResource = (value: string): value is ConfigResource => value in CONFIG_RESOURCE_META;

export function ChangeRequests() {
  const t = useTranslations('admin.changeRequests');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const [status, setStatus] = useState<string>(ChangeRequestStatus.Pending);
  const requests = useInfiniteQuery(changeRequestsQuery(anyToUndefined(status)));
  const title = (row: ChangeRequest) => (
    <Link href={RoutePath.adminChangeRequest(row.id)} className="flex min-w-0 flex-col hover:underline">
      <span className="truncate font-semibold text-navy">{row.reason}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">{t('versionOf', { key: row.documentKey, number: row.versionNumber })}</span>
    </Link>
  );
  const columns: Column<ChangeRequest>[] = [
    { key: 'reason', header: t('change'), cell: title, hideOnCard: true },
    { key: 'resource', header: t('resource'), cell: (row) => enumLabel('configResource', row.resource) },
    { key: 'changes', header: t('changes'), cell: (row) => <span className="tabular">{row.diff?.changes.length ?? 0}</span> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} namespace="enums.changeRequestStatus" /> },
    { key: 'created', header: t('raised'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.createdAt, locale)}</span> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void requests.refetch()} refreshing={requests.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={CHANGE_REQUEST_STATUSES} label={t('status')} allLabel={t('anyStatus')} labelOf={(value) => enumLabel('changeRequestStatus', value)} />
      </FilterBar>
      <PagedList result={requests} columns={columns} rowKey={(row) => row.id} title={title} empty={<EmptyState icon="fact-check" title={t('emptyTitle')} body={status === ANY_VALUE ? t('emptyAll') : t('emptyBody')} />} />
    </div>
  );
}

function RequestView({ request }: { request: ChangeRequest }) {
  const t = useTranslations('admin.changeRequests');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const decide = useMutation({
    mutationFn: ({ kind, note }: { kind: 'approve' | 'reject'; note: string }) => (kind === 'approve' ? approveChangeRequest(request.id, note || undefined) : rejectChangeRequest(request.id, note)),
    meta: { handlesError: true },
    onSuccess: (next, { kind }) => {
      queryClient.setQueryData(adminConfigKeys.changeRequest(request.id), next);
      void queryClient.invalidateQueries({ queryKey: adminConfigKeys.all });
      toast.success(t(kind === 'approve' ? 'approved' : 'rejected'));
      setDialog(null);
    },
    onError: (failure) => errorToast(failure),
  });
  const pending = request.status === ChangeRequestStatus.Pending;
  const versionHref = isResource(request.resource) ? `${CONFIG_RESOURCE_META[request.resource].path}/${request.documentId}?v=${request.versionNumber}` : null;
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.AdminChangeRequests} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={enumLabel('configResource', request.resource)}
        title={request.reason}
        description={t('versionOf', { key: request.documentKey, number: request.versionNumber })}
        badge={<StatusBadge status={request.status} tone={toneOf(REVIEW_STATUS_TONE, request.status)} namespace="enums.changeRequestStatus" />}
        actions={
          pending ? (
            <>
              <Button size="sm" onClick={() => setDialog('approve')}>
                <Icon name="check" size={16} />
                {t('approve')}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDialog('reject')}>
                {t('reject')}
              </Button>
            </>
          ) : null
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <Section title={t('diff')}>
          {request.diff?.comparedWith ? <p className="text-xs text-muted-foreground">{t('comparedWith', { number: request.diff.comparedWith.number })}</p> : <p className="text-xs text-muted-foreground">{t('firstVersion')}</p>}
          {(request.diff?.changes.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noChanges')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {request.diff?.changes.map((change) => (
                <li key={`${change.kind}-${change.path}`} className={cn('flex flex-col gap-1 rounded-lg border p-3', change.kind === 'removed' ? 'border-error-soft' : change.kind === 'added' ? 'border-success-soft' : 'border-subtle')}>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={change.kind} tone={toneOf(REVIEW_STATUS_TONE, change.kind)} namespace="enums.diffKind" />
                    <span className="font-mono text-xs break-all text-navy">{change.path}</span>
                  </span>
                  <span className="grid gap-1 font-mono text-xs sm:grid-cols-2">
                    <span className="break-all text-destructive">{shown(change.before)}</span>
                    <span className="break-all text-success">{shown(change.after)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {request.diff?.truncated ? <p className="text-xs text-muted-foreground">{t('truncated')}</p> : null}
        </Section>
        <Section title={t('details')} delay={0.04}>
          <KeyValues
            columns={1}
            items={[
              { label: t('raised'), value: formatDateTime(request.createdAt, locale) },
              { label: t('decided'), value: formatDateTime(request.decidedAt, locale) },
              { label: t('decisionNote'), value: request.decisionNote ?? '—' },
              { label: t('versionStatus'), value: enumLabel('configStatus', request.versionStatus) },
            ]}
          />
          {versionHref ? (
            <Link href={versionHref} className="flex items-center gap-1 text-sm font-semibold text-gold-deep hover:underline">
              {t('openVersion')}
              <Icon name="arrow-forward" size={14} />
            </Link>
          ) : null}
          <p className="text-xs text-muted-foreground">{t('makerChecker')}</p>
        </Section>
      </div>
      <ReasonDialog
        key={dialog ?? 'none'}
        open={dialog !== null}
        onOpenChange={(open) => (open ? null : setDialog(null))}
        title={dialog === 'reject' ? t('rejectTitle') : t('approveTitle')}
        label={t('note')}
        confirmLabel={dialog === 'reject' ? t('reject') : t('approve')}
        destructive={dialog === 'reject'}
        pending={decide.isPending}
        minLength={CONFIG_NOTE_MIN_LENGTH}
        maxLength={CONFIG_NOTE_MAX_LENGTH}
        noteOptional={dialog === 'approve'}
        onConfirm={(note) => (dialog ? decide.mutate({ kind: dialog, note }) : null)}
      />
    </div>
  );
}

export function ChangeRequestDetail() {
  const t = useTranslations('admin.changeRequests');
  const { id } = useParams<{ id: string }>();
  const request = useQuery(changeRequestQuery(id));
  if (request.isPending) return <ScreenSkeleton />;
  if (!request.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <RequestView request={request.data} />;
}
