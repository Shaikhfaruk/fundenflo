import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { StaffSignIn } from '@/components/auth/staff-sign-in';
import { AuthFormSkeleton, AuthShell } from '@/components/shell/auth-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.staff');
  return { title: t('title') };
}

export default async function StaffLoginPage() {
  const t = await getTranslations('auth.staff');
  return (
    <Suspense
      fallback={
        <AuthShell headline={t('headline')} subline={t('subline')}>
          <AuthFormSkeleton />
        </AuthShell>
      }
    >
      <StaffSignIn />
    </Suspense>
  );
}
