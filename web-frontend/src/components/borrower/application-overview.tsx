'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { JourneyStepper } from '@/components/borrower/journey-stepper';
import { StatusBadge } from '@/components/data/status-badge';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { StepHeader } from '@/components/ui/step-header';
import { partyName } from '@/lib/api/applications';
import { applicationQuery, nextStepQuery } from '@/lib/api/journey';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { APPLICATION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

const COPIED_MS = 1600;

const rise = (delay: number) => ({ initial: { opacity: 0, y: -14 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: Duration.Slow, ease: EASE_OUT } }) as const;

export function ApplicationOverview() {
  const t = useTranslations('borrower.overview');
  const tBlockers = useTranslations('borrower.blockers');
  const tJourney = useTranslations('journey');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const { id } = useParams<{ id: string }>();
  const application = useQuery(applicationQuery(id));
  const nextStep = useQuery(nextStepQuery(id));
  const [copied, setCopied] = useState(false);
  if (application.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (!application.data) return null;
  const app = application.data;
  const blockers = nextStep.data?.blockers ?? [];
  const blockerText = (code: string, count: number) => (tBlockers.has(code) ? tBlockers(code, { count }) : tBlockers('generic'));
  const copy = async () => {
    await navigator.clipboard.writeText(app.ref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_MS);
  };
  return (
    <div className="flex flex-col gap-4">
      <StepHeader title={t('heading')} backHref={AppPath.BorrowerHome} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <motion.section {...rise(0)} className="rounded-xl bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t('facility')}</span>
              <StatusBadge status={app.status} tone={toneOf(APPLICATION_STATUS_TONE, app.status)} />
            </div>
            <h1 className="mt-1.5 font-heading text-xl leading-7 font-semibold text-navy">
              {[categoryLabel(app.categoryKey), partyName(app)].filter(Boolean).join(' · ')}
            </h1>
            <p className="mt-4 text-[13px] text-muted-foreground">{t('requested')}</p>
            <p className="font-heading text-[32px] leading-10 font-semibold text-foreground tabular">{app.amountPaise ? formatPaise(app.amountPaise, locale) : <span className="text-lg text-muted-foreground">{t('amountUnset')}</span>}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t('tenure')}</dt>
                <dd className="font-semibold text-foreground tabular">{app.tenureMonths ? t('months', { count: app.tenureMonths }) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('started')}</dt>
                <dd className="font-semibold text-foreground">{formatDate(app.createdAt, locale)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-subtle px-3 py-2">
              <span className="text-sm font-semibold text-navy tabular">{t('appId', { ref: app.ref })}</span>
              <button type="button" onClick={() => void copy()} aria-label={copied ? t('copied') : t('copyId')} className="flex min-h-8 items-center gap-1 rounded-md px-1.5 text-navy hover:bg-card">
                <Icon name={copied ? 'check' : 'copy'} size={16} />
                {copied ? <span className="text-xs font-semibold text-success">{t('copied')}</span> : null}
              </button>
            </div>
          </motion.section>
          {nextStep.data && blockers.length > 0 ? (
            <motion.section {...rise(0.08)} className="flex items-start gap-3 rounded-xl bg-gold-soft p-3.5">
              <IconTile icon="error" tone="gold" className="size-9 rounded-[10px]" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm font-semibold text-navy">{nextStep.data.stage ? t('nextUp', { stage: tJourney(nextStep.data.stage) }) : t('current')}</p>
                <ul className="flex flex-col gap-0.5">
                  {blockers.map((blocker) => (
                    <li key={`${blocker.stage}-${blocker.code}`} className="flex items-center gap-2 text-[13px] text-foreground">
                      <span className="size-1.5 shrink-0 rounded-full bg-gold-deep" aria-hidden="true" />
                      {blockerText(blocker.code, blocker.details.length)}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.section>
          ) : nextStep.data ? (
            <motion.p {...rise(0.08)} className="flex items-center gap-2 rounded-xl bg-success-soft p-3.5 text-sm font-semibold text-success">
              <Icon name="check-circle" size={18} />
              {t('allDone')}
            </motion.p>
          ) : null}
        </div>
        <motion.section {...rise(0.14)} className="rounded-xl bg-card p-4 shadow-card">
          <h2 className="mb-3 font-heading text-lg font-semibold text-navy">{t('journey')}</h2>
          {nextStep.data ? (
            <JourneyStepper current={nextStep.data.stage ?? app.journeyStage} completed={nextStep.data.completed} activeDetail={blockers[0] ? blockerText(blockers[0].code, blockers[0].details.length) : undefined} />
          ) : (
            <Skeleton className="h-80 w-full" />
          )}
        </motion.section>
      </div>
    </div>
  );
}
