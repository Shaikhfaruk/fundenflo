import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthCard, AuthCardSkeleton } from '@/components/auth/auth-card';
import { StaffSignIn } from '@/components/auth/staff-sign-in';
import { Link } from '@/i18n/navigation';
import { AppPath } from '@/lib/constants/routes.constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.staff');
  return { title: t('title') };
}

export default async function StaffLoginPage() {
  const t = await getTranslations('auth.staff');
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthCard
        title={t('title')}
        description={t('subtitle')}
        footer={
          <>
            {t('borrowerLink')}{' '}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" href={AppPath.Login}>
              {t('borrowerCta')}
            </Link>
          </>
        }
      >
        <StaffSignIn />
      </AuthCard>
    </Suspense>
  );
}
