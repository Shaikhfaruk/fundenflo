'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { useJourneyPaths } from '@/components/journey/journey-mode';
import { JourneyPage } from '@/components/journey/journey-page';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { useRouter } from '@/i18n/navigation';
import { assessmentQuery } from '@/lib/api/assessments';
import type { ImprovementItem } from '@/lib/api/types/assessment.types';
import { JOURNEY_SCREEN_STEP, JourneyScreen } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

function Block({ label, body, last }: { label: string; body: string; last?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1 py-3', !last && 'border-b border-subtle')}>
      <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{label}</span>
      <p className="text-[15px]/[22px] text-foreground">{body}</p>
    </div>
  );
}

function TipCard({ item, index }: { item: ImprovementItem; index: number }) {
  const t = useTranslations('flow.improve');
  return (
    <motion.article initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }} className="rounded-xl border-l-[3px] border-gold-deep bg-card py-3 pr-4 pl-4 shadow-card">
      <h2 className="flex items-center gap-2 font-heading text-[17px] leading-6 font-semibold text-navy">
        <Icon name="error" size={18} className="text-gold-deep" />
        {item.title}
      </h2>
      <Block label={t('found')} body={item.found} />
      <Block label={t('why')} body={item.why} />
      <Block label={t('action')} body={item.action} />
      <Block label={t('evidence')} body={item.evidence} last />
    </motion.article>
  );
}

export function ImproveScreen() {
  const paths = useJourneyPaths();
  const t = useTranslations('flow.improve');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const assessment = useQuery(assessmentQuery(id));
  const items = assessment.data?.improvement ?? [];
  const empty = !assessment.isPending && items.length === 0;
  useEffect(() => {
    if (empty) router.replace(paths.step(id, JourneyScreen.Score));
  }, [empty, id, router, paths]);
  if (assessment.isPending || empty) return <ScreenSkeleton />;
  return (
    <JourneyPage applicationId={id} step={JOURNEY_SCREEN_STEP[JourneyScreen.Improve]} title={items.length === 1 ? t('titleOne') : t('titleMany')} description={t('description')} onBack={() => router.push(paths.step(id, JourneyScreen.Score))}>
      <div className="flex flex-col gap-4">
        {items.map((item, index) => (
          <TipCard key={item.id} item={item} index={index} />
        ))}
        <p className="flex items-start gap-2 rounded-lg bg-subtle p-3.5 text-[13px]/[19px] text-muted-foreground">
          <Icon name="sync-alt" size={16} className="mt-0.5" />
          {t('reassess')}
        </p>
      </div>
      <div className="min-h-4 flex-1" />
      <div className="flex flex-col gap-1 pt-4">
        <ButtonLink href={paths.step(id, JourneyScreen.Lenders)} className="w-full">
          {t('continue')}
          <Icon name="arrow-forward" size={18} />
        </ButtonLink>
        <ButtonLink href={paths.step(id, JourneyScreen.Documents)} variant="ghost" className="w-full text-gold-deep">
          {t('uploadNew')}
        </ButtonLink>
      </div>
    </JourneyPage>
  );
}
