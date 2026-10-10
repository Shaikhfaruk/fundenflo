'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { JourneyFooter } from '@/components/journey/journey-footer';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { Icon } from '@/components/ui/icon';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Spinner } from '@/components/ui/spinner';
import { StepHeader } from '@/components/ui/step-header';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import { applicationKeys } from '@/lib/api/applications';
import { analysisQuery, requestAnalysis } from '@/lib/api/assessments';
import { nextStepQuery } from '@/lib/api/journey';
import { subscribeToUpdates } from '@/lib/api/notifications';
import type { AnalysisStep } from '@/lib/api/types/assessment.types';
import { ANALYSIS_RUN_PARAM, AnalysisStatus, AnalysisStepState } from '@/lib/constants/assessment.constants';
import { JOURNEY_SCREEN_STEP, JOURNEY_TOTAL_STEPS, JourneyScreen, screenForStage, UpdateChannel, UpdateEvent } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { formatPhone } from '@/lib/format/phone';
import { useMe } from '@/lib/session/use-me';
import { cn } from '@/lib/utils';

const SPIN_SECONDS = 1.4;

function Halo({ done, failed }: { done: boolean; failed: boolean }) {
  const reduced = useReducedMotion();
  const still = done || failed;
  return (
    <div className="relative flex size-[200px] items-center justify-center" aria-hidden="true">
      <motion.span className="absolute inset-0 rounded-full bg-gold-soft" animate={still || reduced ? { opacity: 0.7, scale: 1 } : { opacity: [0.5, 1, 0.5], scale: [0.94, 1, 0.94] }} transition={still || reduced ? { duration: Duration.Base } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div animate={still || reduced ? { rotate: 0 } : { rotate: 360 }} transition={still || reduced ? { duration: Duration.Base } : { duration: SPIN_SECONDS, repeat: Infinity, ease: 'linear' }}>
        <ProgressRing progress={still ? 1 : 0.72} size={140} stroke={4} trackClassName="stroke-[#ede6d3]" barClassName={failed ? 'stroke-destructive' : done ? 'stroke-success' : 'stroke-gold'} />
      </motion.div>
      <span className="absolute flex size-24 items-center justify-center rounded-full bg-card shadow-card">
        <Icon name={done ? 'check' : failed ? 'error' : 'document'} size={38} className={done ? 'text-success' : failed ? 'text-destructive' : 'text-navy'} />
      </span>
    </div>
  );
}

function StepRow({ step, failed, first }: { step: AnalysisStep; failed: boolean; first: boolean }) {
  const t = useTranslations('flow.analysis');
  const done = step.state === AnalysisStepState.Done;
  const active = step.state === AnalysisStepState.Active;
  const skipped = step.state === AnalysisStepState.Skipped;
  return (
    <li className={cn('flex items-center gap-3.5 py-4', !first && 'border-t border-subtle')} aria-label={`${step.label}: ${t(`state.${step.state}`)}`}>
      <span className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-full bg-subtle', done && 'bg-success-soft')}>
        {done ? <Icon name="check-circle" size={20} className="text-success" /> : active && !failed ? <Spinner className="size-4 text-gold" /> : active || step.state === AnalysisStepState.Failed ? <Icon name="error" size={18} className="text-destructive" /> : skipped ? <Icon name="info" size={17} className="text-muted-foreground" /> : null}
      </span>
      <span className={cn('flex-1 text-[15px] text-foreground', active && 'font-semibold text-navy', step.state === AnalysisStepState.Pending && 'text-muted-foreground')}>{step.label}</span>
    </li>
  );
}

function AnalysisRun({ applicationId, analysisId }: { applicationId: string; analysisId: string }) {
  const t = useTranslations('flow.analysis');
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const { data: me } = useMe();
  const analysis = useQuery(analysisQuery(applicationId, analysisId));
  const nextStep = useQuery(nextStepQuery(applicationId));
  const [notified, setNotified] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const status = analysis.data?.status;
  const done = status === AnalysisStatus.Done;
  const failed = status === AnalysisStatus.Failed;
  const notify = useMutation({
    mutationFn: () => subscribeToUpdates({ event: UpdateEvent.AnalysisCompleted, entityId: analysisId, channel: UpdateChannel.Sms }),
    meta: { handlesError: true },
    onSuccess: () => setNotified(true),
    onError: (failure) => setNotifyError(errorText(failure)),
  });
  const retry = useMutation({
    mutationFn: () => requestAnalysis(applicationId),
    meta: { handlesError: true },
    onSuccess: (next) => router.replace(`${RoutePath.applicationStep(applicationId, JourneyScreen.Analysis)}?${ANALYSIS_RUN_PARAM}=${next.id}`),
  });
  const continueTo = () => {
    void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
    const screen = screenForStage(nextStep.data?.stage, nextStep.data?.blockers[0]?.code);
    router.push(RoutePath.applicationStep(applicationId, screen === JourneyScreen.Verify ? JourneyScreen.Verify : JourneyScreen.Score));
  };
  if (analysis.isPending) return <ScreenSkeleton />;
  const mobile = me?.mobile ? formatPhone(me.mobile) : null;
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col">
      <StepHeader step={JOURNEY_SCREEN_STEP[JourneyScreen.Analysis]} total={JOURNEY_TOTAL_STEPS} backHref={RoutePath.applicationStep(applicationId, JourneyScreen.Documents)} />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: Duration.Slow }} className="mt-4 flex flex-col items-center text-center">
        <Halo done={done} failed={failed} />
        <h1 className="mt-4 font-heading text-2xl leading-8 font-semibold text-navy" aria-live="polite">
          {done ? t('doneTitle') : failed ? t('failedTitle') : t('title')}
        </h1>
        {done ? <p className="mt-1.5 text-sm text-muted-foreground">{t('doneBody')}</p> : null}
        {failed ? <p className="mt-1.5 text-sm text-destructive">{t('failedBody')}</p> : null}
      </motion.div>
      <motion.ol initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: Duration.Base, ease: EASE_OUT }} className="mt-4 rounded-xl bg-card px-4 shadow-card">
        {(analysis.data?.steps ?? []).map((step, index) => (
          <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + index * STAGGER_STEP }}>
            <StepRow step={step} failed={failed} first={index === 0} />
          </motion.div>
        ))}
      </motion.ol>
      {analysis.isRefetchError ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Icon name="refresh" size={14} />
          {t('reconnecting')}
        </p>
      ) : null}
      <AnimatePresence initial={false}>
        {!done && !failed ? (
          <motion.div key="notify" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 flex flex-col items-center gap-2">
            {notified ? (
              <p className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-[13px]/[19px] text-success">
                <Icon name="check-circle" size={16} className="mt-0.5" />
                {mobile ? t('notifiedAt', { mobile }) : t('notified')}
              </p>
            ) : (
              <>
                <p className="text-center text-[13px]/5 text-muted-foreground">{t('safeToLeave')}</p>
                <button type="button" onClick={() => notify.mutate()} disabled={notify.isPending} className="flex min-h-12 items-center gap-2 rounded-lg px-4 text-[15px] font-semibold text-navy hover:bg-subtle disabled:opacity-60">
                  {notify.isPending ? <Spinner className="text-success" /> : <Icon name="sms" size={20} className="text-success" />}
                  {t('notifyMe')}
                </button>
                {notifyError ? <p className="text-center text-xs text-destructive">{notifyError}</p> : null}
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="min-h-4 flex-1" />
      {done ? <JourneyFooter label={t('continue')} onContinue={continueTo} note={t('private')} /> : null}
      {failed ? (
        <JourneyFooter
          label={t('retry')}
          icon="refresh"
          onContinue={() => retry.mutate()}
          pending={retry.isPending}
          error={retry.error ? errorText(retry.error) : null}
          note={t('kept')}
          secondary={
            <Link href={RoutePath.applicationStep(applicationId, JourneyScreen.Documents)} className="flex min-h-11 items-center justify-center text-sm font-semibold text-gold-deep">
              {t('backToDocuments')}
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

export function AnalysisScreen() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const run = search.get(ANALYSIS_RUN_PARAM);
  const router = useRouter();
  useEffect(() => {
    if (!run) router.replace(RoutePath.applicationStep(id, JourneyScreen.Score));
  }, [run, id, router]);
  if (!run) return <ScreenSkeleton />;
  return <AnalysisRun key={run} applicationId={id} analysisId={run} />;
}
