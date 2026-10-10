'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type ReactNode, Suspense } from 'react';

import { Logo, LogoMark } from '@/components/brand/logo';
import { UserMenu } from '@/components/shell/user-menu';
import { Icon } from '@/components/ui/icon';
import { Link, usePathname } from '@/i18n/navigation';
import type { MeView } from '@/lib/api/types/auth.types';
import { SOFT_SPRING } from '@/lib/constants/motion.constants';
import type { NavItem } from '@/lib/constants/navigation.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { cn } from '@/lib/utils';

import { activeHref } from './nav-model';

const firstName = (me: MeView | undefined) => me?.fullName?.trim().split(/\s+/)[0] ?? null;

function DesktopLinks({ tabs, active }: { tabs: NavItem[]; active: string | null }) {
  const t = useTranslations('nav');
  return tabs.map((item) => {
    const on = active === item.href;
    return (
      <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} className={cn('relative flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-navy', on && 'text-navy')}>
        {on ? <motion.span layoutId="borrower-nav-pill" transition={SOFT_SPRING} className="absolute inset-0 rounded-lg bg-subtle" /> : null}
        <span className="relative flex items-center gap-2">
          <Icon name={item.icon} size={20} />
          {t(item.key)}
        </span>
      </Link>
    );
  });
}

function TabLinks({ tabs, active }: { tabs: NavItem[]; active: string | null }) {
  const t = useTranslations('nav');
  return tabs.map((item) => {
    const on = active === item.href;
    return (
      <li key={item.href} className="flex-1">
        <Link href={item.href} aria-current={on ? 'page' : undefined} className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] leading-[14px] text-muted-foreground transition-colors active:scale-95', on && 'font-semibold text-navy')}>
          <Icon name={item.icon} size={22} />
          <span className="truncate">{t(item.key)}</span>
          <span className="relative mt-1 flex size-1 items-center justify-center">{on ? <motion.span layoutId="borrower-tab-dot" transition={SOFT_SPRING} className="size-1 rounded-full bg-gold-deep" /> : null}</span>
        </Link>
      </li>
    );
  });
}

function ActiveDesktopLinks({ tabs }: { tabs: NavItem[] }) {
  const pathname = usePathname();
  return <DesktopLinks tabs={tabs} active={activeHref(tabs, pathname)} />;
}

function ActiveTabLinks({ tabs }: { tabs: NavItem[] }) {
  const pathname = usePathname();
  return <TabLinks tabs={tabs} active={activeHref(tabs, pathname)} />;
}

export function BorrowerShell({ me, tabs, children }: { me: MeView | undefined; tabs: NavItem[]; children: ReactNode }) {
  const t = useTranslations('shell');
  const name = firstName(me);
  return (
    <div className="flex min-h-dvh flex-col bg-background safe-x">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md safe-top">
        <div className="mx-auto flex h-16 w-full max-w-[560px] items-center gap-2 px-4 lg:max-w-6xl">
          <Link href={AppPath.BorrowerHome} aria-label={t('home')} className="flex shrink-0 items-center rounded-lg focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none">
            <LogoMark size={32} className="lg:hidden" />
            <Logo height={30} className="hidden lg:block" priority />
          </Link>
          <p className="min-w-0 flex-1 truncate font-heading text-base font-semibold text-navy lg:hidden">{name ? t('greeting', { name }) : t('greetingAnonymous')}</p>
          <nav aria-label={t('menu')} className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            <Suspense fallback={<DesktopLinks tabs={tabs} active={null} />}>
              <ActiveDesktopLinks tabs={tabs} />
            </Suspense>
          </nav>
          <p className="hidden max-w-48 truncate font-heading text-sm font-semibold text-navy lg:block">{name ? t('greeting', { name }) : t('greetingAnonymous')}</p>
          <Link href={AppPath.AccountNotifications} aria-label={t('notifications')} className="relative flex size-11 items-center justify-center rounded-full text-navy transition-colors hover:bg-subtle focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none">
            <Icon name="notifications" size={22} />
          </Link>
          <UserMenu me={me} />
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 px-4 pt-4 pb-4 lg:max-w-5xl">
        {children}
        <div className="h-20 shrink-0 lg:hidden" aria-hidden="true" />
      </main>
      <nav aria-label={t('menu')} className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 backdrop-blur-md safe-bottom lg:hidden">
        <ul className="mx-auto flex max-w-[560px] items-stretch justify-around pt-2">
          <Suspense fallback={<TabLinks tabs={tabs} active={null} />}>
            <ActiveTabLinks tabs={tabs} />
          </Suspense>
        </ul>
      </nav>
    </div>
  );
}
