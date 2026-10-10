'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/data/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import type { MembershipView } from '@/lib/api/types/auth.types';
import { LoginAs, MembershipStatus, SessionContext } from '@/lib/constants/auth.constants';
import { homePathFor } from '@/lib/constants/navigation.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { StatusTone } from '@/lib/constants/status.constants';
import { switchContext } from '@/lib/session/client-session';
import { useMe } from '@/lib/session/use-me';

const CONTEXT_ICON: Record<string, IconName> = { [SessionContext.Borrower]: 'person', [SessionContext.Partner]: 'handshake', [SessionContext.Lender]: 'bank', [SessionContext.Staff]: 'shield' };

export function SwitchScreen() {
  const t = useTranslations('account.switch');
  const tRoles = useTranslations('roles');
  const tContexts = useTranslations('contexts');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const select = useMutation({
    mutationFn: (target: { membershipId: string } | { loginAs: 'borrower' }) => switchContext(target),
    onSuccess: (payload) => {
      queryClient.clear();
      const context = payload.user.activeContext?.context ?? SessionContext.None;
      toast.success(t('switched', { role: tContexts.has(context) ? tContexts(context) : context }));
      router.replace(homePathFor(context, payload.user.activeContext?.role));
    },
  });
  if (!me) return <Skeleton className="h-48 w-full rounded-xl" />;
  const hasBorrower = me.memberships.some((membership) => membership.context === SessionContext.Borrower);
  const hasPartner = me.memberships.some((membership) => membership.context === SessionContext.Partner);
  const renderMembership = (membership: MembershipView) => {
    const icon = CONTEXT_ICON[membership.context] ?? 'work';
    const current = me.activeContext?.membershipId === membership.id;
    return (
      <li key={membership.id}>
        <Card size="sm">
          <CardContent className="flex flex-wrap items-center gap-3">
            <IconTile icon={icon} tone={current ? 'navy' : 'subtle'} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{tRoles.has(membership.role) ? tRoles(membership.role) : membership.role}</p>
              <p className="text-xs text-muted-foreground">{membership.organization?.name ?? (tContexts.has(membership.context) ? tContexts(membership.context) : membership.context)}</p>
            </div>
            {membership.status !== MembershipStatus.Active ? <StatusBadge status={membership.status} tone={StatusTone.Warning} /> : null}
            {current ? (
              <Badge variant="gold">{t('current')}</Badge>
            ) : (
              <Button variant="outline" size="sm" disabled={membership.status !== MembershipStatus.Active || select.isPending} onClick={() => select.mutate({ membershipId: membership.id })}>
                {t('use')}
                <Icon name="arrow-forward" size={16} />
              </Button>
            )}
          </CardContent>
        </Card>
      </li>
    );
  };
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold text-navy">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <ul className="flex flex-col gap-2">{me.memberships.map(renderMembership)}</ul>
      {hasBorrower ? null : (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t('borrowerTitle')}</CardTitle>
            <CardDescription>{t('borrowerBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={() => select.mutate({ loginAs: LoginAs.Borrower })} disabled={select.isPending}>
              {t('use')}
            </Button>
          </CardContent>
        </Card>
      )}
      {hasPartner ? null : (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t('becomePartner')}</CardTitle>
            <CardDescription>{t('becomePartnerBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ButtonLink variant="secondary" href={AppPath.PartnerSignup}>
              {t('becomePartner')}
            </ButtonLink>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
