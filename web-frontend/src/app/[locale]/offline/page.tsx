import { WifiOff } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ReloadButton } from '@/components/pwa/reload-button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export default async function OfflinePage() {
  const t = await getTranslations('pwa');
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WifiOff />
          </EmptyMedia>
          <EmptyTitle>{t('offlineTitle')}</EmptyTitle>
          <EmptyDescription>{t('offlineBody')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ReloadButton />
        </EmptyContent>
      </Empty>
    </main>
  );
}
