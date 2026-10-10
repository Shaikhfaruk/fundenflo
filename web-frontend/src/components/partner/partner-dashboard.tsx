'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

import { StatCard } from '@/components/data/stat-card';
import { StatusBadge } from '@/components/data/status-badge';
import { FadeIn } from '@/components/motion/fade-in';
import { PageHeader } from '@/components/shell/page-header';
import { Eyebrow } from '@/components/ui/eyebrow';
import { IconTile } from '@/components/ui/icon-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { partnerDashboardQuery, partnerProfileQuery } from '@/lib/api/partners';
import { PartnerVerificationStatus } from '@/lib/constants/partner.constants';
import { StatusTone } from '@/lib/constants/status.constants';
import { formatDateTime } from '@/lib/format/date';

const AWAITING_VERIFICATION: readonly string[] = [PartnerVerificationStatus.Pending, PartnerVerificationStatus.InReview];
const VERIFICATION_TONE: Record<string, StatusTone> = {
  [PartnerVerificationStatus.Pending]: StatusTone.Warning,
  [PartnerVerificationStatus.InReview]: StatusTone.Info,
  [PartnerVerificationStatus.Verified]: StatusTone.Success,
  [PartnerVerificationStatus.Rejected]: StatusTone.Danger,
};
const CARD_STEP = 0.06;

export function PartnerDashboard() {
  const t = useTranslations('partner.dashboard');
  const locale = useLocale();
  const profile = useQuery(partnerProfileQuery());
  const verified = profile.data?.verification.status === PartnerVerificationStatus.Verified;
  const dashboard = useQuery({ ...partnerDashboardQuery(), enabled: verified });
  const status = profile.data?.verification.status;
  const data = dashboard.data;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={profile.data?.name}
        title={t('title')}
        badge={status ? <StatusBadge status={status} tone={VERIFICATION_TONE[status] ?? StatusTone.Neutral} /> : null}
        description={data ? t('asOf', { time: formatDateTime(data.at, locale) }) : t('description')}
      />
      {status && AWAITING_VERIFICATION.includes(status) ? (
        <FadeIn className="flex items-start gap-3 rounded-xl bg-gold-soft p-4">
          <IconTile icon="hourglass" tone="gold" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-navy">{t('pending')}</p>
            <p className="text-[13px] text-[#5d4200]/85">{t('pendingBody')}</p>
          </div>
        </FadeIn>
      ) : null}
      {status === PartnerVerificationStatus.Rejected ? (
        <FadeIn className="flex items-start gap-3 rounded-xl border border-error-soft bg-[#fff8f7] p-4">
          <IconTile icon="error" tone="danger" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-destructive">{t('rejected')}</p>
            <p className="text-[13px] text-destructive/85">{t('rejectedBody')}</p>
          </div>
        </FadeIn>
      ) : null}
      {profile.isPending || (verified && dashboard.isPending) ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="flex flex-col gap-4">
          <Eyebrow>{t('leadsGroup')}</Eyebrow>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('offered')} value={data.leads.offered} icon="inbox" tone="gold" hint={t('offeredHint')} />
            <StatCard label={t('active')} value={data.leads.active} icon="phone" tone="navy" hint={t('activeHint')} delay={CARD_STEP} />
            <StatCard label={t('firstContactDue')} value={data.leads.firstContactDue} icon="alarm" tone={data.leads.firstContactDue > 0 ? 'danger' : 'success'} hint={t('firstContactHint')} delay={CARD_STEP * 2} />
            <StatCard label={t('protected')} value={data.referrals.protected} icon="shield" tone="info" hint={t('protectedHint')} delay={CARD_STEP * 3} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <Eyebrow>{t('followUpsGroup')}</Eyebrow>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label={t('dueToday')} value={data.followUps.dueToday} icon="event" tone="navy" delay={CARD_STEP * 4} />
                <StatCard label={t('overdue')} value={data.followUps.overdue} icon="schedule" tone={data.followUps.overdue > 0 ? 'danger' : 'success'} delay={CARD_STEP * 5} />
              </div>
            </section>
            <section className="flex flex-col gap-3">
              <Eyebrow>{t('resultsGroup')}</Eyebrow>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label={t('conversionsPending')} value={data.conversions.pending} icon="pending" tone="gold" delay={CARD_STEP * 6} />
                <StatCard label={t('wonThisMonth')} value={data.conversions.wonThisMonth} icon="trophy" tone="success" delay={CARD_STEP * 7} />
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
