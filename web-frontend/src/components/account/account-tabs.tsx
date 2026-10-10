'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { SOFT_SPRING } from '@/lib/constants/motion.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'profile', href: AppPath.Account },
  { key: 'security', href: AppPath.AccountSecurity },
  { key: 'consents', href: AppPath.AccountConsents },
  { key: 'notifications', href: AppPath.AccountNotifications },
  { key: 'privacy', href: AppPath.AccountPrivacy },
  { key: 'switch', href: AppPath.AccountSwitch },
] as const;

export function AccountTabs() {
  const t = useTranslations('account.tabs');
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1 rounded-xl bg-subtle p-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.key}>
              <Link href={tab.href} aria-current={active ? 'page' : undefined} className={cn('relative inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-navy', active && 'font-semibold text-navy')}>
                {active ? <motion.span layoutId="account-tab" transition={SOFT_SPRING} className="absolute inset-0 rounded-lg bg-card shadow-soft" /> : null}
                <span className="relative">{t(tab.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
