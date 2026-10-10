import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { OtpSignIn } from '@/components/auth/otp-sign-in';
import { AuthFormSkeleton, AuthShell } from '@/components/shell/auth-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login');
  return { title: t('title') };
}

export default async function LoginPage() {
  const t = await getTranslations('auth.login');
  return (
    <Suspense
      fallback={
        <AuthShell headline={t('headline')} subline={t('subline')}>
          <AuthFormSkeleton />
        </AuthShell>
      }
    >
      <OtpSignIn />
    </Suspense>
  );
}
