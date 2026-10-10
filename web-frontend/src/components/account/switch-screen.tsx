'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Briefcase, Building2, Handshake, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/data/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import type { MembershipView } from '@/lib/api/types/auth.types';
import { LoginAs, MembershipStatus, SessionContext } from '@/lib/constants/auth.constants';
import { AppPath, HOME_BY_CONTEXT } from '@/lib/constants/routes.constants';
import { StatusTone } from '@/components/data/status-badge';
import { switchContext } from '@/lib/session/client-session';
import { useMe } from '@/lib/session/use-me';

const CONTEXT_ICON = { [SessionContext.Borrower]: UserRound, [SessionContext.Partner]: Handshake, [SessionContext.Lender]: Building2, [SessionContext.Staff]: ShieldCheck } as const;

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
      router.replace(HOME_BY_CONTEXT[context] ?? AppPath.AccountSwitch);
    },
  });
  if (!me) return <Skeleton className="h-48 w-full rounded-xl" />;
  const hasBorrower = me.memberships.some((membership) => membership.context === SessionContext.Borrower);
  const hasPartner = me.memberships.some((membership) => membership.context === SessionContext.Partner);
  const renderMembership = (membership: MembershipView) => {
    const Icon = CONTEXT_ICON[membership.context as keyof typeof CONTEXT_ICON] ?? Briefcase;
    const current = me.activeContext?.membershipId === membership.id;
    return (
      <li key={membership.id}>
        <Card size="sm">
          <CardContent className="flex flex-wrap items-center gap-3">
            <Icon className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{tRoles.has(membership.role) ? tRoles(membership.role) : membership.role}</p>
              <p className="text-xs text-muted-foreground">{membership.organization?.name ?? (tContexts.has(membership.context) ? tContexts(membership.context) : membership.context)}</p>
            </div>
            {membership.status !== MembershipStatus.Active ? <StatusBadge status={membership.status} tone={StatusTone.Warning} /> : null}
            {current ? (
              <Badge>{t('current')}</Badge>
            ) : (
              <Button variant="outline" size="sm" disabled={membership.status !== MembershipStatus.Active || select.isPending} onClick={() => select.mutate({ membershipId: membership.id })}>
                {t('use')}
                <ArrowRight />
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
        <h2 className="text-lg font-semibold">{t('title')}</h2>
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
