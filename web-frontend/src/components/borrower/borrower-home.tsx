'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FilePlus2, FolderOpen } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { applicationsQuery, applicationTitle } from '@/lib/api/applications';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { APPLICATION_STATUS_TONE, CLOSED_APPLICATION_STATUSES, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

export function BorrowerHome() {
  const t = useTranslations('borrower.home');
  const tJourney = useTranslations('journey');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const applications = useQuery(applicationsQuery());
  const items = applications.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <ButtonLink href={AppPath.BorrowerNewApplication}>
            <FilePlus2 />
            {t('new')}
          </ButtonLink>
        }
      />
      {applications.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((key) => (
            <Skeleton key={key} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen />
            </EmptyMedia>
            <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
            <EmptyDescription>{t('emptyBody')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ButtonLink href={AppPath.BorrowerNewApplication}>{t('new')}</ButtonLink>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((application) => {
            const closed = CLOSED_APPLICATION_STATUSES.includes(application.status);
            return (
              <li key={application.id}>
                <Link href={RoutePath.application(application.id)} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <Card className="h-full transition-colors hover:bg-muted/40">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="truncate">{applicationTitle(application)}</CardTitle>
                        <StatusBadge status={application.status} tone={toneOf(APPLICATION_STATUS_TONE, application.status)} />
                      </div>
                      <CardDescription className="tabular">
                        {application.ref} · {categoryLabel(application.categoryKey)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm">
                      <p className="text-lg font-semibold tabular">{application.amountPaise ? formatPaise(application.amountPaise, locale) : <span className="text-base font-normal text-muted-foreground">{t('amountUnset')}</span>}</p>
                      <div className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span>{closed ? t('closed') : t('nextStep', { stage: tJourney.has(application.journeyStage) ? tJourney(application.journeyStage) : application.journeyStage })}</span>
                        <ArrowRight className="size-4" />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('updated', { when: formatRelative(application.updatedAt, locale) })}</p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
