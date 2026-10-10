import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AcceptInvitation } from '@/components/auth/accept-invitation';
import { AuthCard, AuthCardSkeleton } from '@/components/auth/auth-card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.invite');
  return { title: t('title') };
}

export default async function StaffInvitePage() {
  const t = await getTranslations('auth.invite');
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthCard title={t('title')} description={t('subtitle')}>
        <AcceptInvitation />
      </AuthCard>
    </Suspense>
  );
}
