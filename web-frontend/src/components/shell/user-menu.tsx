'use client';

import { useTranslations } from 'next-intl';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import type { MeView } from '@/lib/api/types/auth.types';
import { AppPath } from '@/lib/constants/routes.constants';
import { formatPhone } from '@/lib/format/phone';
import { signOut } from '@/lib/session/client-session';
import { initialsOf } from '@/lib/session/use-me';

export function UserMenu({ me, align = 'end', size = 'sm' }: { me: MeView | undefined; align?: 'start' | 'end'; size?: 'sm' | 'default' }) {
  const t = useTranslations('shell');
  const tCommon = useTranslations('common');
  const tRoles = useTranslations('roles');
  const identity = me?.fullName ?? (formatPhone(me?.mobile) || me?.email) ?? '';
  const role = me?.activeContext?.role;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-95" aria-label={t('account')}>
        <Avatar size={size}>
          <AvatarFallback>{me?.fullName ? initialsOf(me.fullName, me.fullName) : <Icon name="person" size={18} />}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="truncate text-sm font-semibold text-navy">{identity}</span>
            {role ? (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {tRoles.has(role) ? tRoles(role) : role}
                {me?.activeContext?.organization ? ` · ${me.activeContext.organization.name}` : ''}
              </span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={AppPath.Account} />}>
          <Icon name="account" size={20} className="text-muted-foreground" />
          {t('account')}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={AppPath.AccountSwitch} />}>
          <Icon name="swap" size={20} className="text-muted-foreground" />
          {t('switchRole')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
          <Icon name="logout" size={20} />
          {tCommon('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
