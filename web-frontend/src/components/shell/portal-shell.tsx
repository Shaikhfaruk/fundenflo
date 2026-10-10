'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type ReactNode, Suspense, useState } from 'react';

import { LogoMark } from '@/components/brand/logo';
import { UserMenu } from '@/components/shell/user-menu';
import { Icon } from '@/components/ui/icon';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Link, usePathname } from '@/i18n/navigation';
import type { MeView } from '@/lib/api/types/auth.types';
import { SOFT_SPRING } from '@/lib/constants/motion.constants';
import type { NavArea, NavGroup } from '@/lib/constants/navigation.constants';
import { homePathFor } from '@/lib/constants/navigation.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { formatPhone } from '@/lib/format/phone';
import { cn } from '@/lib/utils';

import { activeHref } from './nav-model';

const identityOf = (me: MeView | undefined) => me?.fullName ?? (formatPhone(me?.mobile) || me?.email) ?? '';

function NavLinks({ groups, active, onNavigate }: { groups: NavGroup[]; active: string | null; onNavigate?: () => void }) {
  const t = useTranslations('nav');
  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          {groups.length > 1 && t.has(group.key) ? <p className="px-3 text-[11px] font-semibold tracking-[0.1em] text-white/60 uppercase">{t(group.key)}</p> : null}
          {group.items.map((item) => {
            const on = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={on ? 'page' : undefined}
                className={cn('relative flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-3 focus-visible:ring-gold/40 focus-visible:outline-none', on && 'bg-white/[0.07] text-white')}
              >
                {on ? <motion.span layoutId="portal-marker" transition={SOFT_SPRING} className="absolute top-2 bottom-2 -left-px w-1 rounded-r-full bg-gold shadow-glow-gold" /> : null}
                <Icon name={item.icon} size={22} className={on ? 'text-gold' : undefined} />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function ActiveNavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavLinks groups={groups} active={activeHref(groups.flatMap((group) => group.items), pathname)} onNavigate={onNavigate} />;
}

function SidebarBody({ area, me, groups, onNavigate }: { area: NavArea; me: MeView | undefined; groups: NavGroup[]; onNavigate?: () => void }) {
  const t = useTranslations('shell');
  const tRoles = useTranslations('roles');
  const home = me?.activeContext ? homePathFor(me.activeContext.context, me.activeContext.role) : AppPath.Landing;
  const role = me?.activeContext?.role;
  return (
    <div className="flex h-full flex-col gap-4 px-3 py-4">
      <Link href={home} onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-1 py-1 focus-visible:ring-3 focus-visible:ring-gold/40 focus-visible:outline-none">
        <span className="flex size-11 items-center justify-center rounded-full ring-[1.5px] ring-gold/70">
          <LogoMark size={30} />
        </span>
        <span className="flex flex-col">
          <span className="font-heading text-xl leading-6 font-semibold text-white">FundenFlo</span>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-sidebar-foreground uppercase">{t(`areas.${area}`)}</span>
        </span>
      </Link>
      {me?.activeContext?.organization ? (
        <div className="rounded-lg bg-white/5 px-3 py-3">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase">{t('organisation')}</p>
          <p className="truncate text-sm font-semibold text-white">{me.activeContext.organization.name}</p>
        </div>
      ) : null}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <Suspense fallback={<NavLinks groups={groups} active={null} />}>
          <ActiveNavLinks groups={groups} onNavigate={onNavigate} />
        </Suspense>
      </div>
      <div className="flex items-start gap-3 rounded-xl bg-white/5 p-4">
        <span className="mt-1.5 size-2 shrink-0 animate-pulse-soft rounded-full bg-[#34c26b]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase">{t('signedInAs')}</p>
          <p className="truncate text-sm font-semibold text-white">{identityOf(me)}</p>
          {role ? <p className="truncate text-xs text-sidebar-foreground">{tRoles.has(role) ? tRoles(role) : role}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function PortalShell({ area, me, groups, children }: { area: NavArea; me: MeView | undefined; groups: NavGroup[]; children: ReactNode }) {
  const t = useTranslations('shell');
  const tRoles = useTranslations('roles');
  const [open, setOpen] = useState(false);
  const role = me?.activeContext?.role;
  return (
    <div className="flex min-h-dvh bg-background safe-x">
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 bg-sidebar lg:block">
        <SidebarBody area={area} me={me} groups={groups} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-card/85 backdrop-blur-md safe-top">
          <div className="flex h-16 items-center gap-3 px-4">
            <button type="button" onClick={() => setOpen(true)} aria-label={t('openMenu')} className="-ml-2 flex size-11 items-center justify-center rounded-lg text-navy hover:bg-subtle lg:hidden">
              <Icon name="menu" size={24} />
            </button>
            <LogoMark size={28} className="lg:hidden" />
            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              {me?.activeContext?.organization ? <span className="flex h-9 items-center rounded-lg bg-subtle px-3 text-sm font-semibold text-navy">{me.activeContext.organization.name}</span> : null}
              {role ? (
                <span className="flex h-7 items-center gap-1.5 rounded-full bg-success-soft px-3 text-[11px] font-semibold tracking-[0.06em] text-success uppercase">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  {tRoles.has(role) ? tRoles(role) : role}
                </span>
              ) : null}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Link href={AppPath.AccountNotifications} aria-label={t('notifications')} className="flex size-10 items-center justify-center rounded-lg bg-subtle text-navy transition-colors hover:bg-[#e5ebf2]">
                <Icon name="notifications" size={22} />
              </Link>
              <span className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
              <div className="hidden min-w-0 flex-col items-end sm:flex">
                <span className="max-w-48 truncate font-heading text-sm font-semibold text-navy">{identityOf(me)}</span>
                {me?.activeContext?.organization ? <span className="max-w-48 truncate text-xs text-muted-foreground">{me.activeContext.organization.name}</span> : null}
              </div>
              <UserMenu me={me} size="default" />
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-4">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">{children}</div>
        </main>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-72 max-w-[85vw] gap-0 border-none bg-sidebar p-0 text-white">
          <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
          <SidebarBody area={area} me={me} groups={groups} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
