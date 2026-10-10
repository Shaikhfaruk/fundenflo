'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TotpSetup } from '@/components/auth/totp-setup';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { staffLogin } from '@/lib/api/auth';
import type { StaffLoginResult } from '@/lib/api/types/auth.types';
import { OTP_LENGTH, StaffAuthError } from '@/lib/constants/auth.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import { NEXT_PARAM } from '@/lib/constants/routes.constants';
import { currentDevice } from '@/lib/device';
import { destinationAfterSignIn } from '@/lib/session/after-sign-in';
import { verifyMfa } from '@/lib/session/client-session';

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);
const RESTART_ERRORS: readonly string[] = [StaffAuthError.MfaTokenInvalid];

const buildSchema = (t: (key: string) => string) => z.object({ email: z.email(t('EMAIL_INVALID')), password: z.string().min(1, t('VALIDATION_FAILED')) });

type Values = z.infer<ReturnType<typeof buildSchema>>;

export function StaffSignIn() {
  const t = useTranslations('auth.staff');
  const tErrors = useTranslations('errors');
  const toastError = useErrorToast();
  const errorText = useErrorText();
  const router = useRouter();
  const search = useSearchParams();
  const [challenge, setChallenge] = useState<StaffLoginResult | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(buildSchema(tErrors)), defaultValues: { email: search.get('email') ?? '', password: '' } });

  const login = useMutation({
    mutationFn: staffLogin,
    meta: { handlesError: true },
    onSuccess: (result) => {
      setCode('');
      setCodeError(null);
      setChallenge(result);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === StaffAuthError.CredentialsInvalid) form.setError('password', { message: errorText(error) });
      else toastError(error);
    },
  });

  const mfa = useMutation({
    mutationFn: (value: string) => verifyMfa({ mfaToken: challenge?.mfaToken, code: value, device: currentDevice() }),
    meta: { handlesError: true },
    onSuccess: (payload) => router.replace(destinationAfterSignIn(payload, search.get(NEXT_PARAM))),
    onError: (error) => {
      if (error instanceof ApiError && RESTART_ERRORS.includes(error.code)) {
        setChallenge(null);
        toastError(error);
        return;
      }
      if (error instanceof ApiError && (error.code === StaffAuthError.MfaCodeInvalid || error.code === ErrorCode.ValidationFailed)) setCodeError(errorText(error));
      else toastError(error);
    },
  });

  if (challenge) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === OTP_LENGTH) mfa.mutate(code);
        }}
      >
        {challenge.mfaSetup ? <TotpSetup otpauthUrl={challenge.mfaSetup.otpauthUrl} secret={challenge.mfaSetup.secret} /> : <p className="text-sm text-muted-foreground">{t('mfaSubtitle')}</p>}
        <Field data-invalid={Boolean(codeError)}>
          <FieldLabel htmlFor="totp">{t('mfaTitle')}</FieldLabel>
          <InputOTP id="totp" maxLength={OTP_LENGTH} value={code} onChange={setCode} onComplete={(value: string) => mfa.mutate(value)} inputMode="numeric" autoComplete="one-time-code" autoFocus disabled={mfa.isPending}>
            <InputOTPGroup>
              {SLOTS.map((index) => (
                <InputOTPSlot key={index} index={index} aria-invalid={Boolean(codeError)} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {codeError ? <FieldError>{codeError}</FieldError> : null}
        </Field>
        <Button type="submit" size="lg" disabled={mfa.isPending || code.length !== OTP_LENGTH}>
          {mfa.isPending ? <Spinner /> : null}
          {t('submit')}
        </Button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => login.mutate(values))} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(form.formState.errors.email)}>
          <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
          <Input id="email" type="email" autoComplete="username" aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
          <FieldError errors={[form.formState.errors.email]} />
        </Field>
        <Field data-invalid={Boolean(form.formState.errors.password)}>
          <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
          <FieldError errors={[form.formState.errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={login.isPending}>
        {login.isPending ? <Spinner /> : null}
        {t('submit')}
      </Button>
    </form>
  );
}
