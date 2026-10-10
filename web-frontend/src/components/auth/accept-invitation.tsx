'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconInput } from '@/components/ui/icon-input';
import { Spinner } from '@/components/ui/spinner';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { acceptStaffInvitation } from '@/lib/api/auth';
import { STAFF_PASSWORD_MAX_LENGTH, STAFF_PASSWORD_MIN_LENGTH } from '@/lib/constants/auth.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { applyFieldErrors } from '@/lib/forms/field-errors';

const buildSchema = (t: (key: string, values?: Record<string, number>) => string) =>
  z
    .object({
      fullName: z.string().trim().min(2).max(80),
      password: z.string().min(STAFF_PASSWORD_MIN_LENGTH, t('passwordHint', { min: STAFF_PASSWORD_MIN_LENGTH })).max(STAFF_PASSWORD_MAX_LENGTH),
      confirm: z.string(),
    })
    .refine((values) => values.password === values.confirm, { path: ['confirm'], message: t('mismatch') });

type Values = z.infer<ReturnType<typeof buildSchema>>;

export function AcceptInvitation() {
  const t = useTranslations('auth.invite');
  const toastError = useErrorToast();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const form = useForm<Values>({ resolver: zodResolver(buildSchema(t)), defaultValues: { fullName: '', password: '', confirm: '' } });
  const accept = useMutation({
    mutationFn: (values: Values) => acceptStaffInvitation({ token, fullName: values.fullName, password: values.password }),
    meta: { handlesError: true },
    onSuccess: (result) => {
      toast.success(t('done', { email: result.email }));
      router.replace(AppPath.StaffLogin);
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, ['fullName', 'password'])) toastError(error);
    },
  });
  return (
    <form className="flex flex-1 flex-col" onSubmit={form.handleSubmit((values) => accept.mutate(values))} noValidate>
      <h2 className="font-heading text-2xl leading-8 font-semibold tracking-[-0.01em] text-foreground">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      <FieldGroup className="mt-4 gap-4">
        <Field data-invalid={Boolean(form.formState.errors.fullName)}>
          <FieldLabel htmlFor="fullName">{t('fullName')}</FieldLabel>
          <IconInput id="fullName" icon="person" autoComplete="name" aria-invalid={Boolean(form.formState.errors.fullName)} {...form.register('fullName')} />
          <FieldError errors={[form.formState.errors.fullName]} />
        </Field>
        <Field data-invalid={Boolean(form.formState.errors.password)}>
          <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
          <IconInput id="password" icon="key" type="password" revealLabel={{ show: t('showPassword'), hide: t('hidePassword') }} autoComplete="new-password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
          <FieldDescription>{t('passwordHint', { min: STAFF_PASSWORD_MIN_LENGTH })}</FieldDescription>
          <FieldError errors={[form.formState.errors.password]} />
        </Field>
        <Field data-invalid={Boolean(form.formState.errors.confirm)}>
          <FieldLabel htmlFor="confirm">{t('confirm')}</FieldLabel>
          <IconInput id="confirm" icon="key" type="password" autoComplete="new-password" aria-invalid={Boolean(form.formState.errors.confirm)} {...form.register('confirm')} />
          <FieldError errors={[form.formState.errors.confirm]} />
        </Field>
      </FieldGroup>
      <div className="min-h-4 flex-1" />
      <Button type="submit" className="mt-4 w-full" disabled={accept.isPending}>
        {accept.isPending ? <Spinner /> : null}
        {t('submit')}
        {accept.isPending ? null : <Icon name="arrow-forward" size={18} />}
      </Button>
    </form>
  );
}
