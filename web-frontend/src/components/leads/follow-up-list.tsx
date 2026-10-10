'use client';

import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/data/empty-state';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorToast } from '@/hooks/use-error-toast';
import { Link } from '@/i18n/navigation';
import type { FollowUp } from '@/lib/api/types/lead.types';
import { FollowUpStatus, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { REVIEW_STATUS_TONE, StatusTone, toneOf } from '@/lib/constants/status.constants';
import { DAY_MS, formatDateTime } from '@/lib/format/date';
import { cn } from '@/lib/utils';

export type FollowUpChange = { status?: string; dueAt?: string; outcomeNote?: string };

type Props = { items: FollowUp[]; pending: boolean; leadHref: (item: FollowUp) => string | null; update: (id: string, change: FollowUpChange) => Promise<unknown>; onUpdated: () => void };

export function FollowUpList({ items, pending, leadHref, update, onUpdated }: Props) {
  const t = useTranslations('leadWork.followUps');
  const locale = useLocale();
  const errorToast = useErrorToast();
  const [closing, setClosing] = useState<FollowUp | null>(null);
  const change = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FollowUpChange }) => update(id, body),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('saved'));
      setClosing(null);
      onUpdated();
    },
    onError: (failure) => errorToast(failure),
  });
  if (pending) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (items.length === 0) return <EmptyState icon="alarm" title={t('emptyTitle')} body={t('emptyBody')} />;
  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const href = leadHref(item);
          return (
            <li key={item.id} className={cn('flex flex-col gap-2 rounded-xl border border-[#eef2f6] bg-card p-4 shadow-card sm:flex-row sm:items-center', item.overdue && 'border-l-[3px] border-l-destructive')}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{item.note}</span>
                <span className="text-xs text-muted-foreground">{t('due', { when: formatDateTime(item.dueAt, locale) })}</span>
                {href ? (
                  <Link href={href} className="text-xs font-semibold text-gold-deep hover:underline">
                    {item.lead?.name ? t('openNamed', { name: item.lead.name, ref: item.lead.ref }) : t('openLead')}
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.overdue ? <StatusBadge status="overdue" tone={StatusTone.Danger} namespace="leadWork.followUps" /> : <StatusBadge status={item.status} tone={toneOf(REVIEW_STATUS_TONE, item.status)} />}
                {item.status === FollowUpStatus.Open ? (
                  <>
                    <Button size="xs" variant="outline" onClick={() => change.mutate({ id: item.id, body: { dueAt: new Date(Math.max(Date.now(), new Date(item.dueAt).getTime()) + DAY_MS).toISOString() } })} disabled={change.isPending}>
                      {t('snooze')}
                    </Button>
                    <Button size="xs" onClick={() => setClosing(item)}>
                      {t('done')}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => change.mutate({ id: item.id, body: { status: FollowUpStatus.Cancelled } })} disabled={change.isPending}>
                      {t('cancel')}
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <ReasonDialog
        open={closing !== null}
        onOpenChange={(open) => (open ? null : setClosing(null))}
        title={t('doneTitle')}
        label={t('outcome')}
        confirmLabel={t('done')}
        pending={change.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        noteOptional
        onConfirm={(note) => (closing ? change.mutate({ id: closing.id, body: { status: FollowUpStatus.Done, ...(note ? { outcomeNote: note } : {}) } }) : null)}
      />
    </>
  );
}
