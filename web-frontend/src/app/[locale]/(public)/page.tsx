import { ArrowRight, BadgeCheck, Building2, FileLock2, Gauge, Handshake, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { SegmentList } from '@/components/public/segment-list';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginAs } from '@/lib/constants/auth.constants';
import { AppPath } from '@/lib/constants/routes.constants';

const STEPS = [
  { key: 'profile', icon: Handshake },
  { key: 'documents', icon: FileLock2 },
  { key: 'score', icon: Gauge },
  { key: 'lenders', icon: BadgeCheck },
] as const;

export default async function LandingPage() {
  const t = await getTranslations('landing');
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-4 lg:gap-16">
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-primary">{t('eyebrow')}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t('title')}</h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">{t('subtitle')}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink size="lg" href={AppPath.Login}>
              {t('getStarted')}
              <ArrowRight />
            </ButtonLink>
            <ButtonLink size="lg" variant="outline" href={AppPath.Login}>
              {t('signIn')}
            </ButtonLink>
          </div>
          <p className="flex items-start gap-2 pt-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            {t('privacy')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <Handshake className="size-6 text-primary" />
              <CardTitle>{t('partnerTitle')}</CardTitle>
              <CardDescription>{t('partnerBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ButtonLink variant="secondary" href={{ pathname: AppPath.Login, query: { as: LoginAs.Ca } }}>
                {t('partnerCta')}
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Building2 className="size-6 text-primary" />
              <CardTitle>{t('staffTitle')}</CardTitle>
              <CardDescription>{t('staffBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ButtonLink variant="secondary" href={AppPath.StaffLogin}>
                {t('staffCta')}
              </ButtonLink>
            </CardContent>
          </Card>
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">{t('stepsTitle')}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li key={key}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2 text-primary">
                    <Icon className="size-5" />
                    <span className="text-sm font-medium tabular">{index + 1}</span>
                  </div>
                  <CardTitle>{t(`steps.${key}.title`)}</CardTitle>
                  <CardDescription>{t(`steps.${key}.body`)}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ol>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">{t('segmentsTitle')}</h2>
        <SegmentList />
      </section>
    </div>
  );
}
