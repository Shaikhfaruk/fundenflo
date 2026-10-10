'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { useJourneyPaths } from '@/components/journey/journey-mode';
import { JourneyPage } from '@/components/journey/journey-page';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { ProgressRing } from '@/components/ui/progress-ring';
import { SecureNote } from '@/components/ui/secure-note';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import { assessmentQuery, requestAnalysis } from '@/lib/api/assessments';
import type { Assessment, ScoreFactor } from '@/lib/api/types/assessment.types';
import { ANALYSIS_RUN_PARAM, SCORE_MAX, ScoreStatus } from '@/lib/constants/assessment.constants';
import { JOURNEY_SCREEN_STEP, JourneyScreen } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { formatDate } from '@/lib/format/date';
import { cn } from '@/lib/utils';

const PERCENT = 100;

function FactorRow({ factor, href, index }: { factor: ScoreFactor; href: string | null; index: number }) {
  const t = useTranslations('flow.score');
  const width = factor.score !== null && factor.max > 0 ? Math.round((factor.score / factor.max) * PERCENT) : 0;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{factor.label}</span>
          {factor.attention ? <span className="rounded-xs bg-[#ffdea5] px-1.5 py-0.5 text-[10px] font-semibold text-[#5d4200]">{t('needsAttention')}</span> : null}
          {factor.score === null ? <span className="rounded-xs bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{t(`factorStatus.${factor.status}`)}</span> : null}
        </span>
        <span className="flex items-center gap-0.5 text-sm font-semibold text-foreground tabular">
          {factor.score ?? '—'}
          <span className="font-normal text-muted-foreground">/{factor.max}</span>
          {href ? <Icon name="chevron-right" size={18} className="text-muted-foreground" /> : null}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
        <motion.div className={cn('h-full rounded-full bg-navy', factor.attention && 'bg-gold-deep')} initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ delay: 0.3 + index * STAGGER_STEP, duration: Duration.Slow, ease: EASE_OUT }} />
      </div>
    </>
  );
  if (!href) return <div className="flex flex-col gap-2">{body}</div>;
  return (
    <Link href={href} className="-mx-1 flex flex-col gap-2 rounded-md px-1 py-0.5 hover:bg-subtle/60" aria-label={t('factorNeedsAttention', { name: factor.label })}>
      {body}
    </Link>
  );
}

function ScoreView({ applicationId, assessment }: { applicationId: string; assessment: Assessment }) {
  const paths = useJourneyPaths();
  const t = useTranslations('flow.score');
  const locale = useLocale();
  const { score, improvement } = assessment;
  const scored = score.status === ScoreStatus.Scored && score.value !== null;
  const improveHref = improvement.length > 0 ? paths.step(applicationId, JourneyScreen.Improve) : null;
  return (
    <JourneyPage applicationId={applicationId} step={JOURNEY_SCREEN_STEP[JourneyScreen.Score]} title={t('title')} description={t('description')}>
      <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: Duration.Slow, ease: EASE_OUT }} className="relative isolate flex flex-col items-center overflow-hidden rounded-xl bg-navy p-4 text-center text-white shadow-lift">
        <span className="absolute -top-20 -right-12 -z-10 size-56 rounded-full bg-[#1b365d] opacity-60 glow" aria-hidden="true" />
        <ProgressRing progress={scored ? (score.value ?? 0) / SCORE_MAX : 0} size={176} stroke={10} trackClassName="stroke-white/15" barClassName="stroke-gold" label={scored ? t('scoreLabel', { value: score.value ?? 0 }) : t('noScoreLabel')}>
          {scored ? (
            <span className="flex items-baseline font-heading text-[40px] leading-[48px] font-semibold tabular">
              <AnimatedNumber value={score.value ?? 0} format={(value) => String(value)} />
              <span className="font-sans text-base font-normal text-[#9aabc4]">/{SCORE_MAX}</span>
            </span>
          ) : (
            <span className="font-heading text-[40px] leading-[48px] font-semibold text-[#9aabc4]">—</span>
          )}
        </ProgressRing>
        <p className="mt-4 font-heading text-lg leading-[26px] font-semibold text-balance">{scored ? score.band : t('insufficientBand')}</p>
        <span className="mt-2 flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.03em] text-[#9aabc4]">
          <Icon name="shield" size={14} />
          {t('notBureau')}
        </span>
        <span className="mt-2 text-[10px] font-semibold tracking-[0.03em] text-[#9aabc4]/80">{t('assessedOn', { date: formatDate(score.assessedAt, locale) })}</span>
      </motion.section>
      {!scored ? <p className="mt-4 rounded-xl bg-gold-soft p-3.5 text-[13px]/5 text-[#5d4200]">{t('insufficientBody')}</p> : null}
      <h2 className="mt-4 font-heading text-lg font-semibold text-foreground">{t('factorsTitle')}</h2>
      <div className="mt-2 flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card">
        {score.factors.map((factor, index) => (
          <FactorRow key={factor.id} factor={factor} index={index} href={factor.attention ? improveHref : null} />
        ))}
      </div>
      <p className="mt-3 text-center text-xs/[18px] text-muted-foreground">{t('basedOn', { documents: score.basedOn.documents, facts: score.basedOn.facts })}</p>
      <div className="min-h-4 flex-1" />
      <div className="flex flex-col gap-2 pt-4">
        <ButtonLink href={paths.step(applicationId, JourneyScreen.Lenders)} className="w-full">
          {t('seeLenders')}
          <Icon name="arrow-forward" size={18} />
        </ButtonLink>
        {improveHref ? (
          <ButtonLink href={improveHref} variant="ghost" className="w-full text-gold-deep">
            <Icon name="trending-up" size={18} />
            {t('seeImprove', { count: improvement.length })}
          </ButtonLink>
        ) : null}
        <SecureNote>{t('private')}</SecureNote>
      </div>
    </JourneyPage>
  );
}

function NoScore({ applicationId }: { applicationId: string }) {
  const paths = useJourneyPaths();
  const t = useTranslations('flow.score');
  const router = useRouter();
  const errorText = useErrorText();
  const start = useMutation({
    mutationFn: () => requestAnalysis(applicationId),
    meta: { handlesError: true },
    onSuccess: (analysis) => router.push(`${paths.step(applicationId, JourneyScreen.Analysis)}?${ANALYSIS_RUN_PARAM}=${analysis.id}`),
  });
  return (
    <JourneyPage applicationId={applicationId} step={JOURNEY_SCREEN_STEP[JourneyScreen.Score]} title={t('title')} description={t('description')}>
      <section className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 text-center shadow-card">
        <ProgressRing progress={0} size={120} stroke={8}>
          <Icon name="monitoring" size={36} className="text-navy" />
        </ProgressRing>
        <h2 className="font-heading text-lg font-semibold text-navy">{t('emptyTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
        {start.error ? <p className="text-xs text-destructive">{errorText(start.error)}</p> : null}
        <Button className="w-full" onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? <Spinner /> : <Icon name="sparkle" size={18} />}
          {t('calculate')}
        </Button>
        <Link href={paths.step(applicationId, JourneyScreen.Documents)} className="text-sm font-semibold text-gold-deep">
          {t('checkDocuments')}
        </Link>
      </section>
    </JourneyPage>
  );
}

export function ScoreScreen() {
  const { id } = useParams<{ id: string }>();
  const assessment = useQuery(assessmentQuery(id));
  if (assessment.isPending) return <ScreenSkeleton />;
  if (!assessment.data) return <NoScore applicationId={id} />;
  return <ScoreView applicationId={id} assessment={assessment.data} />;
}
