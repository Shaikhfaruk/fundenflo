import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthCard, AuthCardSkeleton } from '@/components/auth/auth-card';
import { OtpSignIn } from '@/components/auth/otp-sign-in';
import { Link } from '@/i18n/navigation';
import { AppPath } from '@/lib/constants/routes.constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login');
  return { title: t('title') };
}

export default async function LoginPage() {
  const t = await getTranslations('auth.login');
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthCard
        title={t('title')}
        description={t('subtitle')}
        footer={
          <>
            {t('teamLink')}{' '}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" href={AppPath.StaffLogin}>
              {t('teamCta')}
            </Link>
          </>
        }
      >
        <OtpSignIn />
      </AuthCard>
    </Suspense>
  );
}
