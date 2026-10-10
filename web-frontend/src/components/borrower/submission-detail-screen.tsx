'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { submissionSteps } from '@/components/borrower/submission-steps';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Spinner } from '@/components/ui/spinner';
import { StepHeader } from '@/components/ui/step-header';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { applicationKeys } from '@/lib/api/applications';
import { applicationQuery } from '@/lib/api/journey';
import { subscribeToUpdates } from '@/lib/api/notifications';
import { submissionQuery, withdrawSubmission } from '@/lib/api/submissions';
import type { SubmissionDetail } from '@/lib/api/types/submission.types';
import { DocumentRequestStatus } from '@/lib/constants/document.constants';
import { JourneyScreen, SUBMISSION_WITHDRAW_MAX_LENGTH, SUBMISSION_WITHDRAW_MIN_LENGTH, UpdateChannel, UpdateEvent } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { SUBMISSION_STATUS_TONE, SubmissionStatus, toneOf, WITHDRAWABLE_SUBMISSION_STATUSES } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';
import { formatPhone } from '@/lib/format/phone';
import { useMe } from '@/lib/session/use-me';
import { cn } from '@/lib/utils';

const COPIED_MS = 1600;

const rise = (delay: number) => ({ initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: Duration.Slow, ease: EASE_OUT } }) as const;

function StatusTimeline({ submission }: { submission: SubmissionDetail }) {
  const t = useTranslations('flow.submission');
  const locale = useLocale();
  const steps = submissionSteps(submission.status, submission.events);
  const query = submission.status === SubmissionStatus.QueryRaised ? submission.events.findLast((event) => event.toStatus === SubmissionStatus.QueryRaised) : undefined;
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <motion.li key={step.status} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }} className="flex gap-3" aria-current={step.state === 'active' ? 'step' : undefined}>
            <div className="flex w-[22px] flex-col items-center">
              <span className={cn('flex size-[22px] shrink-0 items-center justify-center rounded-full bg-border text-white', step.state === 'done' && 'bg-success', step.state === 'active' && 'bg-gold')}>{step.state === 'done' ? <Icon name="check" size={12} /> : null}</span>
              {last ? null : <span className={cn('my-0.5 min-h-7 w-0.5 flex-1 rounded-full bg-border', step.state === 'done' && 'bg-success')} />}
            </div>
            <div className={cn('flex min-w-0 flex-1 flex-col pb-4', last && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className={cn('flex-1 text-[15px] font-semibold text-foreground', step.state === 'pending' && 'font-medium text-muted-foreground')}>{t(`steps.${step.status}.title`)}</span>
                {step.state === 'active' ? <span className="rounded-xs bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] text-navy uppercase">{t('active')}</span> : null}
                {step.at ? <span className="text-xs text-muted-foreground">{formatDate(step.at, locale)}</span> : null}
              </div>
              <span className="mt-0.5 text-[13px]/[18px] text-muted-foreground">{step.status === SubmissionStatus.UnderReview && query ? t('queryRaised', { note: query.note ?? '' }) : t(`steps.${step.status}.detail`)}</span>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function Detail({ applicationId, submission }: { applicationId: string; submission: SubmissionDetail }) {
  const t = useTranslations('flow.submission');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const errorToast = useErrorToast();
  const { data: me } = useMe();
  const application = useQuery(applicationQuery(applicationId));
  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const follow = useMutation({
    mutationFn: () => subscribeToUpdates({ event: UpdateEvent.SubmissionStatusChanged, entityId: submission.id, channel: UpdateChannel.Sms }),
    meta: { handlesError: true },
    onSuccess: () => {
      setFollowing(true);
      toast.success(t('followed'));
    },
    onError: (failure) => errorToast(failure),
  });
  const withdraw = useMutation({
    mutationFn: (reason: string) => withdrawSubmission(applicationId, submission.id, reason),
    meta: { handlesError: true },
    onSuccess: () => {
      setWithdrawOpen(false);
      toast.success(t('withdrawn'));
      void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
    },
    onError: (failure) => toast.error(errorText(failure)),
  });
  const copy = async () => {
    await navigator.clipboard.writeText(submission.ref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_MS);
  };
  const openRequests = submission.documentRequests.filter((request) => request.status === DocumentRequestStatus.Open);
  const lender = submission.lender.name ?? t('lender');
  const mobile = me?.mobile ? formatPhone(me.mobile) : t('yourMobile');
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      <StepHeader title={t('heading')} backHref={RoutePath.applicationStep(applicationId, JourneyScreen.Submissions)} />
      <motion.section {...rise(0)} className="rounded-xl bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t('facility')}</span>
          <StatusBadge status={submission.status} tone={toneOf(SUBMISSION_STATUS_TONE, submission.status)} />
        </div>
        <h1 className="mt-1.5 font-heading text-xl leading-7 font-semibold text-navy">{t('facilityLine', { product: submission.product.name, lender })}</h1>
        <p className="mt-4 text-[13px] text-muted-foreground">{t('requested')}</p>
        <p className="font-heading text-[32px] leading-10 font-semibold text-foreground tabular">{application.data?.amountPaise ? formatPaise(application.data.amountPaise, locale) : '—'}</p>
        {submission.sanction ? (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-success-soft p-3 text-sm">
            <div>
              <p className="text-xs text-success">{t('sanctioned')}</p>
              <p className="font-semibold text-foreground tabular">{formatPaise(submission.sanction.amountPaise, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-success">{t('disbursed')}</p>
              <p className="font-semibold text-foreground tabular">{submission.disbursal.amountPaise > 0 ? formatPaise(submission.disbursal.amountPaise, locale) : '—'}</p>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-subtle px-3 py-2">
          <span className="text-sm font-semibold text-navy tabular">{t('reference', { ref: submission.ref })}</span>
          <button type="button" onClick={() => void copy()} aria-label={copied ? t('copied') : t('copy')} className="flex min-h-8 items-center gap-1 rounded-md px-1.5 text-navy hover:bg-card">
            <Icon name={copied ? 'check' : 'copy'} size={16} />
            {copied ? <span className="text-xs font-semibold text-success">{t('copied')}</span> : null}
          </button>
        </div>
      </motion.section>
      {openRequests.length > 0 ? (
        <motion.section {...rise(0.06)} className="flex items-center gap-3 rounded-xl bg-gold-soft p-3.5">
          <IconTile icon="error" tone="gold" className="size-9 rounded-[10px]" />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-sm font-semibold text-navy">{t('requestTitle', { count: openRequests.reduce((sum, request) => sum + request.documentTypes.length, 0) })}</p>
            <p className="truncate text-[13px] text-foreground">{openRequests.flatMap((request) => request.documentTypes.map((type) => type.label)).join(', ')}</p>
          </div>
          <ButtonLink href={RoutePath.applicationStep(applicationId, JourneyScreen.Documents)} size="xs">
            {t('uploadNow')}
          </ButtonLink>
        </motion.section>
      ) : null}
      {submission.rejection ? (
        <motion.p {...rise(0.06)} className="flex items-start gap-2 rounded-xl bg-error-soft p-3.5 text-sm text-destructive">
          <Icon name="info" size={18} className="mt-0.5" />
          {t('rejected', { lender, reason: submission.rejection.label })}
        </motion.p>
      ) : submission.status === SubmissionStatus.Withdrawn ? (
        <motion.p {...rise(0.06)} className="flex items-start gap-2 rounded-xl bg-subtle p-3.5 text-sm text-muted-foreground">
          <Icon name="info" size={18} className="mt-0.5" />
          {t('withdrawnNote')}
        </motion.p>
      ) : null}
      <motion.section {...rise(0.1)} className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="mb-3 font-heading text-lg font-semibold text-navy">{t('status')}</h2>
        <StatusTimeline submission={submission} />
      </motion.section>
      <motion.section {...rise(0.14)} className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-card">
        <Icon name="sms" size={22} className="text-success" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-sm font-semibold text-navy">{t('updatesTitle')}</p>
          <p className="text-xs/[17px] text-muted-foreground">{following ? t('updatesOn', { mobile }) : t('updatesBody', { mobile })}</p>
        </div>
        {following ? (
          <Icon name="check-circle" size={20} className="text-success" label={t('updatesOnLabel')} />
        ) : (
          <Button size="xs" variant="secondary" onClick={() => follow.mutate()} disabled={follow.isPending}>
            {follow.isPending ? <Spinner /> : null}
            {t('turnOn')}
          </Button>
        )}
      </motion.section>
      {WITHDRAWABLE_SUBMISSION_STATUSES.includes(submission.status) ? (
        <Button variant="ghost" className="self-center text-destructive" onClick={() => setWithdrawOpen(true)}>
          {t('withdraw')}
        </Button>
      ) : null}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Icon name="lock" size={14} />
        {t('decision')}
      </p>
      <ReasonDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title={t('withdrawTitle', { lender })}
        description={t('withdrawBody')}
        label={t('withdrawReason')}
        confirmLabel={t('withdrawConfirm')}
        destructive
        pending={withdraw.isPending}
        minLength={SUBMISSION_WITHDRAW_MIN_LENGTH}
        maxLength={SUBMISSION_WITHDRAW_MAX_LENGTH}
        onConfirm={(reason) => withdraw.mutate(reason)}
      />
    </div>
  );
}

export function SubmissionDetailScreen() {
  const t = useTranslations('flow.submission');
  const { id, submissionId } = useParams<{ id: string; submissionId: string }>();
  const submission = useQuery(submissionQuery(id, submissionId));
  if (submission.isPending) return <ScreenSkeleton />;
  if (!submission.data) return <p className="mx-auto max-w-[560px] rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <Detail applicationId={id} submission={submission.data} />;
}
