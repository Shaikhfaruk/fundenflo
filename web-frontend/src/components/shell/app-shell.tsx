'use client';

import { Ellipsis } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, Suspense, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { AreaGuard } from '@/components/shell/area-guard';
import { NavIconGlyph } from '@/components/shell/nav-icon';
import { activeHref, navigationFor, primaryTabs, resolveArea } from '@/components/shell/nav-model';
import { UserMenu } from '@/components/shell/user-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Link, usePathname } from '@/i18n/navigation';
import type { NavGroup, NavItem } from '@/lib/constants/navigation.constants';
import { ShellArea } from '@/lib/constants/navigation.constants';
import { HOME_BY_CONTEXT } from '@/lib/constants/routes.constants';
import { formatPhone } from '@/lib/format/phone';
import { useMe } from '@/lib/session/use-me';
import { cn } from '@/lib/utils';

function NavList({ groups, active, onNavigate }: { groups: NavGroup[]; active: string | null; onNavigate?: () => void }) {
  const t = useTranslations('nav');
  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          {groups.length > 1 && t.has(group.key) ? <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t(group.key)}</p> : null}
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active === item.href ? 'page' : undefined}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                active === item.href && 'bg-sidebar-accent text-sidebar-accent-foreground',
              )}
            >
              <NavIconGlyph icon={item.icon} className="size-4" />
              {t(item.key)}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function ActiveNavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavList groups={groups} active={activeHref(groups.flatMap((group) => group.items), pathname)} onNavigate={onNavigate} />;
}

function NavWithActive({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList groups={groups} active={null} />}>
      <ActiveNavList groups={groups} onNavigate={onNavigate} />
    </Suspense>
  );
}

function TabLinks({ tabs, active }: { tabs: NavItem[]; active: string | null }) {
  const t = useTranslations('nav');
  return tabs.map((item) => (
    <li key={item.href} className="flex-1">
      <Link href={item.href} aria-current={active === item.href ? 'page' : undefined} className={cn('flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground', active === item.href && 'text-primary')}>
        <NavIconGlyph icon={item.icon} className="size-5" />
        <span className="truncate">{t(item.key)}</span>
      </Link>
    </li>
  ));
}

function ActiveTabLinks({ tabs, items }: { tabs: NavItem[]; items: NavItem[] }) {
  const pathname = usePathname();
  return <TabLinks tabs={tabs} active={activeHref(items, pathname)} />;
}

export function AppShell({ area, children }: { area: ShellArea; children: ReactNode }) {
  const tShell = useTranslations('shell');
  const { data: me, isPending } = useMe();
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = navigationFor(resolveArea(area, me), me?.activeContext?.role);
  const items = groups.flatMap((group) => group.items);
  const tabs = primaryTabs(groups);
  const home = HOME_BY_CONTEXT[me?.activeContext?.context ?? ''] ?? '/';
  const hasMore = items.length > tabs.length;
  return (
    <div className="flex min-h-dvh safe-x">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 border-r bg-sidebar px-3 py-4 lg:flex">
        <Link href={home} className="px-2">
          <Logo />
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavWithActive groups={groups} />
        </div>
        <div className="flex items-center gap-2 border-t pt-3">
          <UserMenu me={me} align="start" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{me?.fullName ?? (formatPhone(me?.mobile) || me?.email)}</p>
            <p className="truncate text-xs text-muted-foreground">{me?.activeContext?.organization?.name}</p>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/85 px-4 py-2 backdrop-blur safe-top lg:hidden">
          <Link href={home} aria-label={tShell('home')}>
            <Logo />
          </Link>
          <UserMenu me={me} />
        </header>
        <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4">
          <AreaGuard area={area} me={me} loading={isPending}>
            {children}
          </AreaGuard>
          <div className="h-16 shrink-0 lg:hidden" aria-hidden="true" />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur safe-bottom lg:hidden" aria-label={tShell('menu')}>
          <ul className="mx-auto flex max-w-lg items-stretch justify-around">
            <Suspense fallback={<TabLinks tabs={tabs} active={null} />}>
              <ActiveTabLinks tabs={tabs} items={items} />
            </Suspense>
            {hasMore ? (
              <li className="flex-1">
                <button type="button" onClick={() => setMoreOpen(true)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Ellipsis className="size-5" aria-hidden="true" />
                  <span>{tShell('menu')}</span>
                </button>
              </li>
            ) : null}
          </ul>
        </nav>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto px-4 pb-4 safe-bottom">
            <SheetHeader className="px-0">
              <SheetTitle>{tShell('menu')}</SheetTitle>
            </SheetHeader>
            <NavWithActive groups={groups} onNavigate={() => setMoreOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
