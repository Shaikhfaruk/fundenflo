'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { JourneyStepper } from '@/components/borrower/journey-stepper';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { applicationTitle } from '@/lib/api/applications';
import { applicationQuery, nextStepQuery } from '@/lib/api/journey';
import { APPLICATION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

export function ApplicationOverview() {
  const t = useTranslations('borrower.overview');
  const tBlockers = useTranslations('borrower.blockers');
  const tJourney = useTranslations('journey');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const { id } = useParams<{ id: string }>();
  const application = useQuery(applicationQuery(id));
  const nextStep = useQuery(nextStepQuery(id));
  if (application.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!application.data) return null;
  const app = application.data;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={applicationTitle(app)} description={`${t('title', { ref: app.ref })} · ${categoryLabel(app.categoryKey)}`} actions={<StatusBadge status={app.status} tone={toneOf(APPLICATION_STATUS_TONE, app.status)} />} />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('current')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {nextStep.data ? (
                nextStep.data.blockers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('allDone')}</p>
                ) : (
                  <>
                    <p className="text-lg font-semibold">{nextStep.data.stage ? tJourney(nextStep.data.stage) : ''}</p>
                    <p className="text-sm text-muted-foreground">{t('blockers')}</p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {nextStep.data.blockers.map((blocker) => (
                        <li key={`${blocker.stage}-${blocker.code}`} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
                          {tBlockers.has(blocker.code) ? tBlockers(blocker.code, { count: blocker.details.length }) : tBlockers('generic')}
                        </li>
                      ))}
                    </ul>
                  </>
                )
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('requirement')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">{t('amount')}</dt>
                  <dd className="font-medium tabular">{formatPaise(app.amountPaise, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('tenure')}</dt>
                  <dd className="font-medium tabular">{app.tenureMonths ? t('months', { count: app.tenureMonths }) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('started')}</dt>
                  <dd className="font-medium">{formatDate(app.createdAt, locale)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>{t('journey')}</CardTitle>
          </CardHeader>
          <CardContent>
            <JourneyStepper current={nextStep.data?.stage ?? app.journeyStage} completed={nextStep.data?.completed ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
