import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { ConsentLinkForm } from '@/components/consent/consent-link-form';
import { AuthFormSkeleton, AuthShell } from '@/components/shell/auth-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('consentLink');
  return { title: t('metaTitle') };
}

export default async function ConsentLinkPage() {
  const t = await getTranslations('consentLink');
  return (
    <AuthShell headline={t('headline')} subline={t('subline')} compact>
      <Suspense fallback={<AuthFormSkeleton />}>
        <ConsentLinkForm />
      </Suspense>
    </AuthShell>
  );
}
