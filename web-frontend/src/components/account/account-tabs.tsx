'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
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
    <nav className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.key}>
              <Link href={tab.href} aria-current={active ? 'page' : undefined} className={cn('inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground hover:text-foreground', active && 'border-primary text-foreground')}>
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
