'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { ADMIN_TABS, type AdminTabGroup } from '@/lib/constants/admin.constants';
import { cn } from '@/lib/utils';

export function AdminTabs({ group }: { group: AdminTabGroup }) {
  const t = useTranslations(`admin.tabs.${group}`);
  const pathname = usePathname();
  const tabs = ADMIN_TABS[group];
  const active = tabs.findLast((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  return (
    <nav aria-label={t('label')} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-subtle">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.key === active?.key ? 'page' : undefined}
              className={cn('flex h-11 items-center border-b-2 border-transparent px-3 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-navy', tab.key === active?.key && 'border-gold text-navy')}
            >
              {t(tab.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
