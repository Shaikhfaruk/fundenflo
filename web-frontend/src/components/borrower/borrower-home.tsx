'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';

import { useCategoryIcon, useCategoryLabel } from '@/components/borrower/category-labels';
import { JOURNEY_TOTAL, journeyStep } from '@/components/borrower/journey-progress';
import { StatusBadge } from '@/components/data/status-badge';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerList, StaggerListItem } from '@/components/motion/stagger';
import { ButtonLink } from '@/components/ui/button-link';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { applicationsQuery, partyName } from '@/lib/api/applications';
import type { Application } from '@/lib/api/types/application.types';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { APPLICATION_STATUS_TONE, CLOSED_APPLICATION_STATUSES, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';
import { cn } from '@/lib/utils';

const HOW_IT_WORKS: readonly { key: string; icon: IconName }[] = [
  { key: 'profile', icon: 'handshake' },
  { key: 'documents', icon: 'folder' },
  { key: 'score', icon: 'monitoring' },
  { key: 'lenders', icon: 'verified' },
];

function ActiveCard({ application }: { application: Application }) {
  const t = useTranslations('borrower.home');
  const tJourney = useTranslations('journey');
  const tStatus = useTranslations('status');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const step = journeyStep(application.journeyStage);
  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: Duration.Slow, ease: EASE_OUT }} className="relative isolate overflow-hidden rounded-xl bg-navy p-4 text-white shadow-lift">
      <span className="absolute -top-16 -right-12 -z-10 size-48 rounded-full bg-[#1b365d] opacity-60 glow" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-gold uppercase">{t('active')}</span>
        <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">{tStatus.has(application.status) ? tStatus(application.status) : application.status}</span>
      </div>
      <p className="mt-4 font-heading text-xl leading-7 font-semibold">
        {[categoryLabel(application.categoryKey), partyName(application)].filter(Boolean).join(' · ')}
      </p>
      <p className="mt-1 font-heading text-[28px] leading-9 font-semibold tabular">{application.amountPaise ? formatPaise(application.amountPaise, locale) : <span className="text-base font-medium text-[#9aabc4]">{t('amountUnset')}</span>}</p>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#9aabc4]">
          <span>{t('nextStep', { stage: tJourney.has(application.journeyStage) ? tJourney(application.journeyStage) : application.journeyStage })}</span>
          <span className="tabular">{t('stepOf', { step, total: JOURNEY_TOTAL })}</span>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: JOURNEY_TOTAL }, (_, index) => (
            <span key={index} className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              <motion.span className="absolute inset-0 origin-left rounded-full bg-gold" initial={{ scaleX: 0 }} animate={{ scaleX: index < step ? 1 : 0 }} transition={{ delay: 0.3 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }} />
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[13px] text-[#9aabc4] tabular">{t('ref', { ref: application.ref })}</span>
        <Link href={RoutePath.application(application.id)} className="group flex min-h-8 items-center gap-1 text-sm font-semibold text-gold">
          {t('track')}
          <Icon name="arrow-forward" size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </motion.div>
  );
}

function ApplicationRow({ application }: { application: Application }) {
  const t = useTranslations('borrower.home');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const categoryIcon = useCategoryIcon();
  return (
    <Link href={RoutePath.application(application.id)} className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-card transition-transform outline-none hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.99]">
      <IconTile icon={categoryIcon(application.categoryKey)} tone="subtle" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-foreground">{partyName(application) ?? categoryLabel(application.categoryKey)}</span>
        <span className="truncate text-xs text-muted-foreground tabular">
          {application.ref} · {categoryLabel(application.categoryKey)} · {t('updated', { when: formatRelative(application.updatedAt, locale) })}
        </span>
      </span>
      <StatusBadge status={application.status} tone={toneOf(APPLICATION_STATUS_TONE, application.status)} />
      <Icon name="chevron-right" size={18} className="text-muted-foreground" />
    </Link>
  );
}

function HowItWorks({ className }: { className?: string }) {
  const t = useTranslations('borrower.home');
  const tSteps = useTranslations('landing.steps');
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Eyebrow>{t('howItWorks')}</Eyebrow>
      <StaggerList delay={0.12} className="flex flex-col gap-2">
        {HOW_IT_WORKS.map((step, index) => (
          <StaggerListItem key={step.key} className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-card">
            <IconTile icon={step.icon} tone={index === 0 ? 'goldSoft' : 'subtle'} />
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-semibold text-foreground">{tSteps(`${step.key}.title`)}</span>
              <span className="text-xs text-muted-foreground">{tSteps(`${step.key}.body`)}</span>
            </span>
            <span className="ml-auto font-heading text-sm font-semibold text-slate tabular">{String(index + 1).padStart(2, '0')}</span>
          </StaggerListItem>
        ))}
      </StaggerList>
    </div>
  );
}

function Welcome() {
  const t = useTranslations('borrower.home');
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <FadeIn className="relative isolate overflow-hidden rounded-xl bg-navy p-4 text-white shadow-lift">
        <span className="absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-[#1b365d] opacity-60 glow" aria-hidden="true" />
        <span className="absolute -bottom-10 -left-10 -z-10 size-32 rounded-full bg-gold-deep opacity-15 glow" aria-hidden="true" />
        <span className="text-[11px] font-semibold tracking-[0.08em] text-gold uppercase">{t('welcomeKicker')}</span>
        <h1 className="mt-2 font-heading text-[22px] leading-8 font-semibold">{t('emptyTitle')}</h1>
        <p className="mt-1 text-sm text-slate">{t('emptyBody')}</p>
        <ButtonLink href={AppPath.BorrowerNewApplication} variant="gold" className="mt-4 w-full">
          {t('startNew')}
          <Icon name="arrow-forward" size={18} />
        </ButtonLink>
      </FadeIn>
      <HowItWorks className="mt-2 lg:mt-0" />
    </div>
  );
}

export function BorrowerHome() {
  const t = useTranslations('borrower.home');
  const tJourney = useTranslations('journey');
  const applications = useQuery(applicationsQuery());
  const items = (applications.data?.items ?? []).toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = items.find((application) => !CLOSED_APPLICATION_STATUSES.includes(application.status));
  const others = items.filter((application) => application !== active);
  if (applications.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-13 rounded-lg" />
      </div>
    );
  }
  if (items.length === 0) return <Welcome />;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {active ? <ActiveCard application={active} /> : null}
        {active ? (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: Duration.Base, ease: EASE_OUT }}>
            <Link href={RoutePath.application(active.id)} className="flex items-center gap-3 rounded-xl bg-gold-soft p-3.5 transition-transform active:scale-[0.99]">
              <IconTile icon="error" tone="gold" className="size-9 rounded-[10px]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-navy">{t('pendingTask')}</span>
                <span className="truncate text-[13px] text-muted-foreground">{tJourney.has(active.journeyStage) ? tJourney(active.journeyStage) : active.journeyStage}</span>
              </span>
              <Icon name="chevron-right" size={18} className="text-muted-foreground" />
            </Link>
          </motion.div>
        ) : null}
        {others.length > 0 ? (
          <>
            <Eyebrow className="mt-2">{t('title')}</Eyebrow>
            <StaggerList delay={0.2} className="flex flex-col gap-2">
              {others.map((application) => (
                <StaggerListItem key={application.id}>
                  <ApplicationRow application={application} />
                </StaggerListItem>
              ))}
            </StaggerList>
          </>
        ) : null}
        <ButtonLink href={AppPath.BorrowerNewApplication} variant="outline" className={cn('w-full', !active && 'mt-2')}>
          <Icon name="add" size={20} />
          {t('startNew')}
        </ButtonLink>
      </div>
      <HowItWorks className="hidden lg:flex" />
    </div>
  );
}
