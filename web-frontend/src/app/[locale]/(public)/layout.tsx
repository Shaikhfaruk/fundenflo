import { getTranslations } from 'next-intl/server';

import { Logo } from '@/components/brand/logo';
import { InstallButton } from '@/components/pwa/install-button';
import { Link } from '@/i18n/navigation';
import { AppPath } from '@/lib/constants/routes.constants';

export default async function PublicLayout({ children }: LayoutProps<'/[locale]'>) {
  const t = await getTranslations('common');
  return (
    <div className="flex min-h-dvh flex-col safe-top safe-x">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={AppPath.Landing} aria-label={t('appName')}>
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <InstallButton variant="ghost" />
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted-foreground safe-bottom">© FundenFlo</footer>
    </div>
  );
}
