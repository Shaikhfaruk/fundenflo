import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AcceptInvitation } from '@/components/auth/accept-invitation';
import { AuthFormSkeleton, AuthShell } from '@/components/shell/auth-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.invite');
  return { title: t('title') };
}

export default async function StaffInvitePage() {
  const t = await getTranslations('auth.invite');
  return (
    <AuthShell headline={t('headline')} subline={t('subline')}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <AcceptInvitation />
      </Suspense>
    </AuthShell>
  );
}
