import { getTranslations } from 'next-intl/server';

import { Logo } from '@/components/brand/logo';
import { ReloadButton } from '@/components/pwa/reload-button';
import { Icon } from '@/components/ui/icon';

export default async function OfflinePage() {
  const t = await getTranslations('pwa');
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-navy px-4 text-center text-white safe-top safe-bottom">
      <span className="absolute size-[520px] rounded-full border border-[#17415f]" aria-hidden="true" />
      <span className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-[#1b365d] opacity-50 glow" aria-hidden="true" />
      <Logo inverse height={52} className="relative" />
      <span className="relative mt-4 flex size-16 items-center justify-center rounded-2xl bg-white/10 text-gold">
        <Icon name="cloud-off" size={32} />
      </span>
      <h1 className="relative mt-4 font-heading text-2xl font-semibold">{t('offlineTitle')}</h1>
      <p className="relative mt-2 max-w-sm text-sm text-slate">{t('offlineBody')}</p>
      <div className="relative mt-4">
        <ReloadButton />
      </div>
    </main>
  );
}
