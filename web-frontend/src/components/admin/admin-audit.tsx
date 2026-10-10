'use client';

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { KeyValues } from '@/components/data/detail-section';
import { DetailSheet } from '@/components/data/detail-sheet';
import { EmptyState } from '@/components/data/empty-state';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { auditEventsQuery, verifyAuditChain } from '@/lib/api/admin';
import type { AuditEvent, AuditVerification } from '@/lib/api/types/admin.types';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { cn } from '@/lib/utils';

const JSON_INDENT = 2;

export function AdminAudit() {
  const t = useTranslations('admin.audit');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const errorToast = useErrorToast();
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [opened, setOpened] = useState<AuditEvent | null>(null);
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const events = useInfiniteQuery(auditEventsQuery({ action: action.trim() || undefined, entityType: entityType.trim() || undefined, entityId: entityId.trim() || undefined }));
  const verify = useMutation({ mutationFn: verifyAuditChain, meta: { handlesError: true }, onSuccess: setVerification, onError: (failure) => errorToast(failure) });
  const title = (row: AuditEvent) => (
    <button type="button" onClick={() => setOpened(row)} className="truncate text-left font-mono text-[13px] font-semibold text-navy hover:underline">
      {row.action}
    </button>
  );
  const columns: Column<AuditEvent>[] = [
    { key: 'action', header: t('action'), cell: title, hideOnCard: true },
    { key: 'entity', header: t('entity'), cell: (row) => <span className="font-mono text-xs">{row.entityType}</span> },
    { key: 'actor', header: t('actor'), cell: (row) => enumLabel('actorContext', row.actorContext ?? row.actorType) },
    { key: 'seq', header: t('seq'), cell: (row) => <span className="tabular text-muted-foreground">{row.seq}</span>, className: 'hidden xl:table-cell' },
    { key: 'when', header: t('when'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.occurredAt, locale)}</span> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button size="sm" variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending}>
            {verify.isPending ? <Spinner /> : <Icon name="shield" size={16} />}
            {t('verify')}
          </Button>
        }
      />
      {verification ? (
        <output className={cn('flex items-center gap-2 rounded-xl px-4 py-3 text-sm', verification.valid ? 'bg-success-soft text-success' : 'bg-error-soft text-destructive')}>
          <Icon name={verification.valid ? 'verified' : 'error'} size={18} />
          {verification.valid ? t('chainValid', { checked: verification.checked, from: verification.fromSeq ?? '—', to: verification.toSeq ?? '—' }) : t('chainBroken', { at: verification.brokenAt ?? '—' })}
        </output>
      ) : null}
      <FilterBar onRefresh={() => void events.refetch()} refreshing={events.isFetching}>
        <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder={t('actionFilter')} aria-label={t('actionFilter')} className="h-11 sm:w-56" />
        <Input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder={t('entityFilter')} aria-label={t('entityFilter')} className="h-11 sm:w-44" />
        <Input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder={t('entityIdFilter')} aria-label={t('entityIdFilter')} className="h-11 sm:w-72" />
      </FilterBar>
      <PagedList result={events} columns={columns} rowKey={(row) => row.id} title={title} empty={<EmptyState icon="history" title={t('emptyTitle')} body={t('emptyBody')} />} />
      {opened ? (
        <DetailSheet open onOpenChange={(open) => (open ? null : setOpened(null))} title={opened.action} description={formatDateTime(opened.occurredAt, locale)}>
          <KeyValues
            columns={1}
            items={[
              { label: t('entity'), value: <span className="font-mono text-xs break-all">{`${opened.entityType} · ${opened.entityId ?? '—'}`}</span> },
              { label: t('actor'), value: <span className="font-mono text-xs break-all">{`${enumLabel('actorContext', opened.actorContext ?? opened.actorType)} · ${opened.actorUserId ?? '—'}`}</span> },
              { label: t('request'), value: <span className="font-mono text-xs break-all">{opened.requestId ?? '—'}</span> },
              { label: t('ip'), value: opened.ip ?? '—' },
              { label: t('seq'), value: opened.seq },
              { label: t('hash'), value: <span className="font-mono text-xs break-all">{opened.hash}</span> },
            ]}
          />
          <pre className="max-h-96 overflow-auto rounded-lg bg-subtle p-3 font-mono text-xs text-navy">{JSON.stringify(opened.metadata ?? {}, null, JSON_INDENT)}</pre>
        </DetailSheet>
      ) : null}
    </div>
  );
}
