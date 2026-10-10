'use client';

import { ArrowLeftRight, LogOut, Monitor, Moon, Sun, UserRound, UserRoundCog } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from '@/i18n/navigation';
import type { MeView } from '@/lib/api/types/auth.types';
import { AppPath } from '@/lib/constants/routes.constants';
import { signOut } from '@/lib/session/client-session';
import { formatPhone } from '@/lib/format/phone';
import { initialsOf } from '@/lib/session/use-me';

const THEMES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;

export function UserMenu({ me, align = 'end' }: { me: MeView | undefined; align?: 'start' | 'end' }) {
  const t = useTranslations('shell');
  const tCommon = useTranslations('common');
  const tRoles = useTranslations('roles');
  const { theme, setTheme } = useTheme();
  const identity = me?.fullName ?? (formatPhone(me?.mobile) || me?.email) ?? '';
  const role = me?.activeContext?.role;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={t('account')} />}>
        <Avatar>
          <AvatarFallback>{me?.fullName ? initialsOf(me.fullName, me.fullName) : <UserRound className="size-4" />}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{identity}</span>
            {role ? <span>{tRoles.has(role) ? tRoles(role) : role}{me?.activeContext?.organization ? ` · ${me.activeContext.organization.name}` : ''}</span> : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={AppPath.Account} />}>
          <UserRoundCog />
          {t('account')}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={AppPath.AccountSwitch} />}>
          <ArrowLeftRight />
          {t('switchRole')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun />
            {tCommon('theme.label')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={(value) => setTheme(String(value))}>
              {THEMES.map(({ value, icon: Icon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon />
                  {tCommon(`theme.${value}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
          <LogOut />
          {tCommon('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
