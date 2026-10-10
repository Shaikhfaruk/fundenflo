'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { OtpDialog } from '@/components/account/otp-dialog';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorText } from '@/hooks/use-error-toast';
import { loginsQuery, meKeys, removeLogin, revokeOtherSessions, revokeSession, sessionsQuery, startLoginLink, startMobileChange, verifyLoginLink, verifyMobileChange } from '@/lib/api/me';
import type { SessionView } from '@/lib/api/types/auth.types';
import { DEFAULT_COUNTRY_CODE, INDIAN_MOBILE_PATTERN } from '@/lib/constants/auth.constants';
import { formatRelative } from '@/lib/format/date';

type Pending = { kind: 'email' | 'mobile'; challengeId: string; destination: string } | null;

function DeviceIcon({ platform }: { platform: string | null }) {
  return <IconTile icon={platform === 'ios' || platform === 'android' ? 'smartphone' : 'laptop'} tone="subtle" />;
}

export function SecurityScreen() {
  const t = useTranslations('account.security');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const sessions = useQuery(sessionsQuery());
  const logins = useQuery(loginsQuery());
  const [confirm, setConfirm] = useState<SessionView | null>(null);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: meKeys.all });

  const revoke = useMutation({ mutationFn: (id: string) => revokeSession(id), onSuccess: () => { setConfirm(null); refresh(); } });
  const revokeOthers = useMutation({ mutationFn: revokeOtherSessions, onSuccess: (result) => { toast.success(t('signedOutOthers', { count: result.revoked })); refresh(); } });
  const remove = useMutation({ mutationFn: removeLogin, onSuccess: () => { toast.success(t('removed')); refresh(); } });
  const linkEmail = useMutation({ mutationFn: () => startLoginLink({ email }), onSuccess: (issued) => { setCodeError(null); setPending({ kind: 'email', challengeId: issued.challengeId, destination: email }); } });
  const changeMobile = useMutation({
    mutationFn: () => startMobileChange({ mobile, countryCode: DEFAULT_COUNTRY_CODE }),
    onSuccess: (issued) => {
      setCodeError(null);
      setPending({ kind: 'mobile', challengeId: issued.challengeId, destination: `${DEFAULT_COUNTRY_CODE} ${mobile}` });
    },
  });
  const verify = useMutation({
    mutationFn: async (code: string) => {
      if (!pending) return;
      if (pending.kind === 'email') await verifyLoginLink({ challengeId: pending.challengeId, otp: code });
      else await verifyMobileChange({ challengeId: pending.challengeId, otp: code });
    },
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(pending?.kind === 'email' ? t('emailAdded') : t('mobileChanged'));
      setPending(null);
      setEmail('');
      setMobile('');
      refresh();
    },
    onError: (error) => setCodeError(errorText(error)),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('devicesTitle')}</CardTitle>
          <CardDescription>{t('devicesDescription')}</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => revokeOthers.mutate()} disabled={revokeOthers.isPending || (sessions.data?.items.length ?? 0) < 2}>
              {t('signOutOthers')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {sessions.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ul className="flex flex-col divide-y">
              {sessions.data?.items.map((session) => (
                <li key={session.id} className="flex items-center gap-3 py-3">
                  <DeviceIcon platform={session.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {session.deviceName ?? session.userAgent ?? session.loginMethod}
                      {session.current ? <Badge variant="secondary">{t('thisDevice')}</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('lastActive', { when: formatRelative(session.lastSeenAt, locale) })}</p>
                  </div>
                  {session.current ? null : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(session)}>
                      {t('signOutDevice')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('loginsTitle')}</CardTitle>
          <CardDescription>{t('loginsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y">
            {logins.data?.items.map((login) => (
              <li key={login.id} className="flex items-center gap-3 py-3">
                <IconTile icon={login.method === 'email_otp' ? 'mail' : 'smartphone'} tone="subtle" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium tabular">{login.identifier}</p>
                  <p className="text-xs text-muted-foreground">{t.has(`method.${login.method}`) ? t(`method.${login.method}`) : login.method}</p>
                </div>
                {login.method === 'mobile_otp' ? null : (
                  <Button variant="ghost" size="icon-sm" aria-label={t('removeLogin')} onClick={() => remove.mutate(login.id)} disabled={remove.isPending}>
                    <Icon name="delete" size={18} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              linkEmail.mutate();
            }}
          >
            <FieldLabel htmlFor="link-email">{t('addEmail')}</FieldLabel>
            <div className="flex gap-2">
              <Input id="link-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <Button type="submit" variant="secondary" disabled={!email || linkEmail.isPending}>
                {tCommon('add')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('mobileTitle')}</CardTitle>
          <CardDescription>{t('mobileDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!INDIAN_MOBILE_PATTERN.test(mobile)) {
                setMobileError(tErrors('MOBILE_INVALID'));
                return;
              }
              setMobileError(null);
              changeMobile.mutate();
            }}
          >
            <Field data-invalid={Boolean(mobileError)}>
              <FieldLabel htmlFor="new-mobile">{t('newMobile')}</FieldLabel>
              <div className="flex gap-2">
                <span className="flex h-10 items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground md:h-9">{DEFAULT_COUNTRY_CODE}</span>
                <Input id="new-mobile" type="tel" inputMode="numeric" maxLength={10} value={mobile} onChange={(event) => setMobile(event.target.value)} />
              </div>
              {mobileError ? <FieldError>{mobileError}</FieldError> : null}
            </Field>
            <Button type="submit" variant="secondary" className="self-start" disabled={!mobile || changeMobile.isPending}>
              {t('sendCode')}
            </Button>
          </form>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('confirmSignOut')}
        description={t('confirmSignOutBody')}
        confirmLabel={t('signOutDevice')}
        destructive
        pending={revoke.isPending}
        onConfirm={() => confirm && revoke.mutate(confirm.id)}
      />
      <OtpDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)} destination={pending?.destination ?? ''} pending={verify.isPending} error={codeError} onVerify={(code) => verify.mutate(code)} />
    </div>
  );
}
