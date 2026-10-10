'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { InstallButton } from '@/components/pwa/install-button';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { usePathname, useRouter } from '@/i18n/navigation';
import { meKeys, updateProfile } from '@/lib/api/me';
import type { MeView } from '@/lib/api/types/auth.types';
import { BACKEND_LOCALES, LOCALE_NAMES, LOCALES } from '@/lib/constants/locale.constants';
import { applyFieldErrors } from '@/lib/forms/field-errors';
import { formatPhone } from '@/lib/format/phone';
import { initialsOf, useMe } from '@/lib/session/use-me';

const schema = z.object({ fullName: z.string().trim().min(2).max(80) });

function NameForm({ me }: { me: MeView }) {
  const t = useTranslations('account.profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { fullName: me.fullName ?? '' } });
  const save = useMutation({
    mutationFn: (fullName: string) => updateProfile({ fullName }, me.version),
    meta: { handlesError: true },
    onSuccess: (updated) => {
      queryClient.setQueryData(meKeys.profile(), updated);
      form.reset({ fullName: updated.fullName ?? '' });
      toast.success(t('saved'));
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, ['fullName'])) form.setError('root', { message: error.message });
    },
  });
  const email = me.logins.find((login) => login.method === 'email_otp')?.identifier ?? me.email;
  return (
    <form onSubmit={form.handleSubmit((values) => save.mutate(values.fullName))} className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={Boolean(form.formState.errors.fullName)}>
          <FieldLabel htmlFor="fullName">{t('fullName')}</FieldLabel>
          <Input id="fullName" autoComplete="name" {...form.register('fullName')} />
          <FieldError errors={[form.formState.errors.fullName, form.formState.errors.root]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>{t('mobile')}</FieldLabel>
            <p className="text-sm font-semibold tabular">{formatPhone(me.mobile) || '—'}</p>
            <FieldDescription>{t('changeInSecurity')}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t('email')}</FieldLabel>
            <p className="text-sm font-semibold">{email ?? t('noEmail')}</p>
          </Field>
        </div>
      </FieldGroup>
      <Button type="submit" size="sm" className="self-start" disabled={save.isPending || !form.formState.isDirty}>
        {save.isPending ? <Spinner /> : null}
        {tCommon('save')}
      </Button>
    </form>
  );
}

export function ProfileScreen() {
  const t = useTranslations('account.profile');
  const { data: me } = useMe();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const language = useMutation({
    mutationFn: (preferredLanguage: string) => updateProfile({ preferredLanguage }, me?.version),
    onSuccess: (updated) => queryClient.setQueryData(meKeys.profile(), updated),
  });
  if (!me) return <Skeleton className="h-64 w-full rounded-xl" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="relative isolate flex items-center gap-4 overflow-hidden rounded-xl bg-navy p-4 text-white shadow-lift lg:col-span-2">
        <span className="absolute -top-16 -right-10 -z-10 size-44 rounded-full bg-[#1b365d] opacity-60 glow" aria-hidden="true" />
        <Avatar size="lg" className="ring-2 ring-gold/60">
          <AvatarFallback className="bg-gold text-navy">{me.fullName ? initialsOf(me.fullName, me.fullName) : <Icon name="person" size={24} />}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-heading text-lg font-semibold">{me.fullName ?? t('addName')}</p>
          <p className="truncate text-[13px] text-[#9aabc4] tabular">{formatPhone(me.mobile) || me.email}</p>
        </div>
      </section>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm key={me.version} me={me} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('languageTitle')}</CardTitle>
          <CardDescription>{t('languageDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel>{t('screenLanguage')}</FieldLabel>
            <Select value={locale} onValueChange={(next) => router.replace(pathname, { locale: String(next) })}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => LOCALE_NAMES[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LOCALE_NAMES[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t('messageLanguage')}</FieldLabel>
            <Select value={me.preferredLanguage ?? 'en'} onValueChange={(next) => language.mutate(String(next))}>
              <SelectTrigger className="w-full" disabled={language.isPending}>
                <SelectValue>{(value: string) => LOCALE_NAMES[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BACKEND_LOCALES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LOCALE_NAMES[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{t('messageLanguageHint')}</FieldDescription>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('appTitle')}</CardTitle>
          <CardDescription>{t('appDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <InstallButton variant="gold" />
          <span className="text-xs text-muted-foreground tabular">{t('version', { version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev' })}</span>
        </CardContent>
      </Card>
    </div>
  );
}
