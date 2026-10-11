'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { useJourneyPaths } from '@/components/journey/journey-mode';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link } from '@/i18n/navigation';
import { applicationKeys, applicationTimelineQuery, withdrawApplication } from '@/lib/api/applications';
import { submissionsQuery } from '@/lib/api/submissions';
import type { ApplicationEvent } from '@/lib/api/types/application.types';
import { APPLICATION_WITHDRAW_MAX_LENGTH, JourneyScreen, SUBMISSION_WITHDRAW_MIN_LENGTH } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { SUBMISSION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';

const ACTIVITY_LIMIT = 8;

const EVENT_ICONS: Record<string, IconName> = {
  created: 'add',
  requirement_changed: 'edit',
  answers_recorded: 'task',
  status_changed: 'sync-alt',
  stage_changed: 'trending-up',
  consent_recorded: 'shield',
  party_added: 'group',
  party_removed: 'group',
  assessment_recorded: 'monitoring',
  match_recorded: 'handshake',
  submission_recorded: 'arrow-outward',
  document_requested: 'document',
};

export function useEventText() {
  const t = useTranslations('borrower.activity');
  const tJourney = useTranslations('journey');
  const tStatus = useTranslations('status');
  return (event: ApplicationEvent) => {
    const to = typeof event.data?.to === 'string' ? event.data.to : null;
    if (event.type === 'stage_changed' && to && tJourney.has(to)) return t('stage_changed', { stage: tJourney(to) });
    if (event.type === 'status_changed' && event.toStatus) return t('status_changed', { status: tStatus.has(event.toStatus) ? tStatus(event.toStatus) : event.toStatus });
    if (event.type === 'submission_recorded' && to) return t('submission_recorded', { status: tStatus.has(to) ? tStatus(to) : to });
    return t.has(event.type) ? t(event.type) : t('other');
  };
}

export function ApplicationActivity({ applicationId, open }: { applicationId: string; open: boolean }) {
  const paths = useJourneyPaths();
  const t = useTranslations('borrower.activity');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const timeline = useQuery(applicationTimelineQuery(applicationId));
  const submissions = useQuery(submissionsQuery(applicationId));
  const text = useEventText();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const withdraw = useMutation({
    mutationFn: (reason: string) => withdrawApplication(applicationId, reason),
    meta: { handlesError: true },
    onSuccess: () => {
      setWithdrawOpen(false);
      toast.success(t('withdrawn'));
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    },
  });
  const events = (timeline.data?.items ?? []).slice(0, ACTIVITY_LIMIT);
  const applied = submissions.data?.items ?? [];
  return (
    <>
      {applied.length > 0 ? (
        <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: Duration.Slow, ease: EASE_OUT }} className="rounded-xl bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold text-navy">{t('applications')}</h2>
            <Link href={paths.step(applicationId, JourneyScreen.Submissions)} className="text-xs font-semibold text-gold-ink">
              {t('seeAll')}
            </Link>
          </div>
          <ul className="flex flex-col">
            {applied.map((submission) => (
              <li key={submission.id} className="border-t border-subtle first:border-t-0">
                <Link href={paths.submission(applicationId, submission.id)} className="flex items-center gap-3 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{submission.lender.name ?? submission.product.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{submission.ref}</span>
                  </span>
                  <StatusBadge status={submission.status} tone={toneOf(SUBMISSION_STATUS_TONE, submission.status)} />
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>
      ) : null}
      <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: Duration.Slow, ease: EASE_OUT }} className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="mb-2 font-heading text-lg font-semibold text-navy">{t('title')}</h2>
        {timeline.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ol className="flex flex-col">
            {events.map((event, index) => (
              <motion.li key={event.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 + index * STAGGER_STEP }} className="flex items-start gap-3 border-t border-subtle py-2.5 first:border-t-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-navy">
                  <Icon name={EVENT_ICONS[event.type] ?? 'history'} size={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm text-foreground">{text(event)}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(event.createdAt, locale)}</span>
                </span>
              </motion.li>
            ))}
          </ol>
        )}
      </motion.section>
      {open ? (
        <Button variant="ghost" className="self-center text-destructive" onClick={() => setWithdrawOpen(true)}>
          {t('withdraw')}
        </Button>
      ) : null}
      <ReasonDialog
        open={withdrawOpen}
        onOpenChange={(next) => {
          setWithdrawOpen(next);
          if (!next) withdraw.reset();
        }}
        title={t('withdrawTitle')}
        description={t('withdrawBody')}
        label={t('withdrawReason')}
        confirmLabel={t('withdrawConfirm')}
        destructive
        pending={withdraw.isPending}
        minLength={SUBMISSION_WITHDRAW_MIN_LENGTH}
        maxLength={APPLICATION_WITHDRAW_MAX_LENGTH}
        error={withdraw.error ? errorText(withdraw.error) : null}
        onConfirm={(reason) => withdraw.mutate(reason)}
      />
    </>
  );
}
