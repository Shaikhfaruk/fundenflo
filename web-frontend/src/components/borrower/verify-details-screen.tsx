'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useJourneyPaths } from '@/components/journey/journey-mode';
import { PanCard } from '@/components/borrower/pan-card';
import { JourneyFooter } from '@/components/journey/journey-footer';
import { JourneyPage } from '@/components/journey/journey-page';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { Icon } from '@/components/ui/icon';
import { useRouter } from '@/i18n/navigation';
import { applicationKeys } from '@/lib/api/applications';
import { borrowerProfileQuery } from '@/lib/api/borrowers';
import { applicationQuery } from '@/lib/api/journey';
import { JOURNEY_SCREEN_STEP, JourneyScreen } from '@/lib/constants/journey.constants';

export function VerifyDetailsScreen() {
  const paths = useJourneyPaths();
  const t = useTranslations('flow.verify');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const application = useQuery(applicationQuery(id));
  const profileId = application.data?.borrowerProfileId;
  const profile = useQuery({ ...borrowerProfileQuery(profileId ?? ''), enabled: Boolean(profileId) });
  if (application.isPending || (profileId && profile.isPending)) return <ScreenSkeleton />;
  if (!profile.data) return <p className="mx-auto max-w-[560px] rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  const verified = profile.data.kyc?.pan?.verified === true;
  const next = () => router.push(paths.step(id, JourneyScreen.Score));
  return (
    <JourneyPage
      applicationId={id}
      step={JOURNEY_SCREEN_STEP[JourneyScreen.Verify]}
      icon={
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="flex size-12 items-center justify-center rounded-xl bg-gold-soft text-navy" aria-hidden="true">
          <Icon name="id-card" size={24} />
        </motion.span>
      }
      title={t('title')}
      description={t('description')}
    >
      <PanCard key={`${profile.data.id}-${verified ? 'v' : 'n'}`} profile={profile.data} onVerified={() => void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(id) })} />
      <p className="mt-4 flex items-start gap-2 px-1 text-xs/[18px] text-muted-foreground">
        <Icon name="lock" size={15} className="mt-px" />
        {t('whyPan')}
      </p>
      <div className="min-h-4 flex-1" />
      <JourneyFooter label={t('continue')} onContinue={next} disabled={!verified} hint={t('hint')} note={t('private')} />
    </JourneyPage>
  );
}
