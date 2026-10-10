'use client';

import { useQuery } from '@tanstack/react-query';
import { AlarmClock, BadgeCheck, CalendarClock, Clock, Gift, Hourglass, Inbox, PhoneCall, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { StatCard } from '@/components/data/stat-card';
import { PageHeader } from '@/components/shell/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { partnerDashboardQuery, partnerProfileQuery } from '@/lib/api/partners';
import { PartnerVerificationStatus } from '@/lib/constants/partner.constants';
import { formatDateTime } from '@/lib/format/date';

const AWAITING_VERIFICATION: readonly string[] = [PartnerVerificationStatus.Pending, PartnerVerificationStatus.InReview];

export function PartnerDashboard() {
  const t = useTranslations('partner.dashboard');
  const locale = useLocale();
  const profile = useQuery(partnerProfileQuery());
  const verified = profile.data?.verification.status === PartnerVerificationStatus.Verified;
  const dashboard = useQuery({ ...partnerDashboardQuery(), enabled: verified });
  const status = profile.data?.verification.status;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={profile.data?.name ?? t('title')} description={dashboard.data ? t('asOf', { time: formatDateTime(dashboard.data.at, locale) }) : t('description')} />
      {status && AWAITING_VERIFICATION.includes(status) ? (
        <Alert>
          <Hourglass />
          <AlertTitle>{t('pending')}</AlertTitle>
          <AlertDescription>{t('pendingBody')}</AlertDescription>
        </Alert>
      ) : null}
      {status === PartnerVerificationStatus.Rejected ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>{t('rejected')}</AlertTitle>
          <AlertDescription>{t('rejectedBody')}</AlertDescription>
        </Alert>
      ) : null}
      {profile.isPending || (verified && dashboard.isPending) ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : dashboard.data ? (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{t('leadsGroup')}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label={t('offered')} value={dashboard.data.leads.offered} icon={Inbox} emphasis={dashboard.data.leads.offered > 0} />
              <StatCard label={t('active')} value={dashboard.data.leads.active} icon={PhoneCall} />
              <StatCard label={t('firstContactDue')} value={dashboard.data.leads.firstContactDue} icon={AlarmClock} emphasis={dashboard.data.leads.firstContactDue > 0} />
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{t('followUpsGroup')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label={t('dueToday')} value={dashboard.data.followUps.dueToday} icon={CalendarClock} />
              <StatCard label={t('overdue')} value={dashboard.data.followUps.overdue} icon={Clock} emphasis={dashboard.data.followUps.overdue > 0} />
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{t('resultsGroup')}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label={t('conversionsPending')} value={dashboard.data.conversions.pending} icon={Hourglass} />
              <StatCard label={t('wonThisMonth')} value={dashboard.data.conversions.wonThisMonth} icon={BadgeCheck} emphasis />
              <StatCard label={t('protected')} value={dashboard.data.referrals.protected} icon={Gift} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
