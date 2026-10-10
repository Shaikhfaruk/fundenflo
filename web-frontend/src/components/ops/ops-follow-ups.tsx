'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/data/empty-state';
import { EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { opsFollowUpsQuery, opsLeadKeys, updateFollowUp } from '@/lib/api/leads';
import type { FollowUp } from '@/lib/api/types/ops.types';
import { FOLLOW_UP_ASSIGNEES, FOLLOW_UP_STATUSES, FollowUpStatus, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, StatusTone, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime } from '@/lib/format/date';
import { cn } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;

export function OpsFollowUps() {
  const t = useTranslations('ops.followUps');
  const statusLabel = useEnumLabel('followUpStatus');
  const assigneeLabel = useEnumLabel('assignee');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [status, setStatus] = useState<string>(FollowUpStatus.Open);
  const [assignee, setAssignee] = useState<string>(FOLLOW_UP_ASSIGNEES[0]);
  const [closing, setClosing] = useState<FollowUp | null>(null);
  const followUps = useQuery(opsFollowUpsQuery({ status, assignee }));
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status?: string; dueAt?: string; outcomeNote?: string } }) => updateFollowUp(id, body),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('saved'));
      setClosing(null);
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
    },
    onError: (failure) => errorToast(failure),
  });
  const items = followUps.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void followUps.refetch()} refreshing={followUps.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={FOLLOW_UP_STATUSES} label={t('status')} labelOf={statusLabel} />
        <EnumSelect value={assignee} onChange={setAssignee} values={FOLLOW_UP_ASSIGNEES} label={t('assignee')} labelOf={assigneeLabel} className="sm:w-40" />
      </FilterBar>
      {followUps.isPending ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState icon="alarm" title={t('emptyTitle')} body={t('emptyBody')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className={cn('flex flex-col gap-2 rounded-xl border border-[#eef2f6] bg-card p-4 shadow-card sm:flex-row sm:items-center', item.overdue && 'border-l-[3px] border-l-destructive')}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{item.note}</span>
                <span className="text-xs text-muted-foreground">{t('due', { when: formatDateTime(item.dueAt, locale) })}</span>
                {item.entityType === 'lead' ? (
                  <Link href={RoutePath.opsLead(item.entityId)} className="text-xs font-semibold text-gold-deep hover:underline">
                    {t('openLead')}
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.overdue ? <StatusBadge status="overdue" tone={StatusTone.Danger} namespace="ops.followUps" /> : <StatusBadge status={item.status} tone={toneOf(REVIEW_STATUS_TONE, item.status)} />}
                {item.status === FollowUpStatus.Open ? (
                  <>
                    <Button size="xs" variant="outline" onClick={() => update.mutate({ id: item.id, body: { dueAt: new Date(Math.max(Date.now(), new Date(item.dueAt).getTime()) + DAY_MS).toISOString() } })} disabled={update.isPending}>
                      {t('snooze')}
                    </Button>
                    <Button size="xs" onClick={() => setClosing(item)}>
                      {t('done')}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => update.mutate({ id: item.id, body: { status: FollowUpStatus.Cancelled } })} disabled={update.isPending}>
                      {t('cancel')}
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        open={closing !== null}
        onOpenChange={(open) => (open ? null : setClosing(null))}
        title={t('doneTitle')}
        label={t('outcome')}
        confirmLabel={t('done')}
        pending={update.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        noteOptional
        onConfirm={(note) => (closing ? update.mutate({ id: closing.id, body: { status: FollowUpStatus.Done, ...(note ? { outcomeNote: note } : {}) } }) : null)}
      />
    </div>
  );
}
