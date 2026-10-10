'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { StatusBadge } from '@/components/data/status-badge';
import { JourneyPage } from '@/components/journey/journey-page';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { submissionsQuery } from '@/lib/api/submissions';
import { JOURNEY_SCREEN_STEP, JourneyScreen } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { SUBMISSION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';

export function SubmissionsScreen() {
  const t = useTranslations('flow.submissions');
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const submissions = useQuery(submissionsQuery(id));
  if (submissions.isPending) return <ScreenSkeleton />;
  const items = submissions.data?.items ?? [];
  return (
    <JourneyPage applicationId={id} step={JOURNEY_SCREEN_STEP[JourneyScreen.Submissions]} title={t('title')} description={t('description')}>
      {items.length === 0 ? (
        <section className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-card">
          <h2 className="font-heading text-lg font-semibold text-navy">{t('emptyTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((submission, index) => (
            <motion.li key={submission.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }}>
              <Link href={RoutePath.submission(id, submission.id)} className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-card transition-transform active:scale-[0.99]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-base font-semibold text-white">{(submission.lender.name ?? '?').charAt(0).toUpperCase()}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-heading text-base font-semibold text-navy">{submission.lender.name ?? t('lender')}</span>
                  <span className="truncate text-xs text-muted-foreground">{t('line', { product: submission.product.name, ref: submission.ref, date: formatDate(submission.createdAt, locale) })}</span>
                </span>
                <StatusBadge status={submission.status} tone={toneOf(SUBMISSION_STATUS_TONE, submission.status)} />
                <Icon name="chevron-right" size={18} className="text-muted-foreground" />
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
      <div className="min-h-4 flex-1" />
      <div className="flex flex-col gap-2 pt-4">
        <ButtonLink href={RoutePath.applicationStep(id, JourneyScreen.Lenders)} variant={items.length === 0 ? 'default' : 'outline'} className="w-full">
          {items.length === 0 ? t('chooseLender') : t('another')}
          <Icon name="arrow-forward" size={18} />
        </ButtonLink>
        <ButtonLink href={RoutePath.application(id)} variant="ghost" className="w-full">
          {t('overview')}
        </ButtonLink>
      </div>
    </JourneyPage>
  );
}
