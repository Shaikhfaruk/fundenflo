'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TotpSetup } from '@/components/auth/totp-setup';
import { AuthShell } from '@/components/shell/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconInput } from '@/components/ui/icon-input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { StepHeader } from '@/components/ui/step-header';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { staffLogin } from '@/lib/api/auth';
import type { StaffLoginResult } from '@/lib/api/types/auth.types';
import { OTP_LENGTH, StaffAuthError } from '@/lib/constants/auth.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { AppPath, NEXT_PARAM } from '@/lib/constants/routes.constants';
import { currentDevice } from '@/lib/device';
import { destinationAfterSignIn } from '@/lib/session/after-sign-in';
import { verifyMfa } from '@/lib/session/client-session';

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);
const RESTART_ERRORS: readonly string[] = [StaffAuthError.MfaTokenInvalid];
const SWAP = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: Duration.Base, ease: EASE_OUT } } as const;

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
  const [attempt, setAttempt] = useState(0);
  const form = useForm<Values>({ resolver: zodResolver(buildSchema(tErrors)), defaultValues: { email: search.get('email') ?? '', password: '' } });
  const errors = form.formState.errors;

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
      if (error instanceof ApiError && (error.code === StaffAuthError.MfaCodeInvalid || error.code === ErrorCode.ValidationFailed)) {
        setCodeError(errorText(error));
        setCode('');
        setAttempt((value) => value + 1);
      } else toastError(error);
    },
  });

  return (
    <AuthShell headline={t('headline')} subline={t('subline')} compact={Boolean(challenge)}>
      <AnimatePresence mode="wait" initial={false}>
        {challenge ? (
          <motion.form
            key="mfa"
            {...SWAP}
            className="flex flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.length === OTP_LENGTH) mfa.mutate(code);
            }}
          >
            <StepHeader onBack={() => setChallenge(null)} className="-mt-2" />
            <h2 className="mt-2 font-heading text-2xl leading-8 font-semibold tracking-[-0.01em] text-foreground">{challenge.mfaSetup ? t('setupTitle') : t('mfaTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{challenge.mfaSetup ? t('setupBody') : t('mfaSubtitle')}</p>
            {challenge.mfaSetup ? <TotpSetup otpauthUrl={challenge.mfaSetup.otpauthUrl} secret={challenge.mfaSetup.secret} /> : null}
            <p className="mt-4 text-sm font-medium text-foreground">{t('codeLabel')}</p>
            <div className="mt-2">
              <InputOTP maxLength={OTP_LENGTH} value={code} onChange={setCode} onComplete={(value: string) => mfa.mutate(value)} inputMode="numeric" autoComplete="one-time-code" autoFocus aria-label={t('codeLabel')} disabled={mfa.isPending}>
                <InputOTPGroup key={attempt}>
                  {SLOTS.map((index) => (
                    <InputOTPSlot key={index} index={index} aria-invalid={Boolean(codeError)} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {codeError ? (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-destructive" role="alert">
                <Icon name="error" size={15} />
                {codeError}
              </p>
            ) : null}
            <div className="min-h-4 flex-1" />
            <Button type="submit" className="mt-4 w-full" disabled={mfa.isPending || code.length !== OTP_LENGTH}>
              {mfa.isPending ? <Spinner /> : null}
              {t('verify')}
            </Button>
          </motion.form>
        ) : (
          <motion.form key="credentials" {...SWAP} className="flex flex-1 flex-col" onSubmit={form.handleSubmit((values) => login.mutate(values))} noValidate>
            <h2 className="font-heading text-2xl leading-8 font-semibold tracking-[-0.01em] text-foreground">{t('title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
            <FieldGroup className="mt-4 gap-4">
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
                <IconInput id="email" icon="mail" type="email" autoComplete="username" placeholder={t('emailPlaceholder')} aria-invalid={Boolean(errors.email)} {...form.register('email')} />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
                <IconInput id="password" icon="key" type="password" autoComplete="current-password" revealLabel={{ show: t('showPassword'), hide: t('hidePassword') }} aria-invalid={Boolean(errors.password)} {...form.register('password')} />
                <FieldError errors={[errors.password]} />
              </Field>
            </FieldGroup>
            <Button type="submit" className="mt-4 w-full" disabled={login.isPending}>
              {login.isPending ? <Spinner /> : null}
              {t('submit')}
              {login.isPending ? null : <Icon name="arrow-forward" size={18} />}
            </Button>
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-subtle px-3 py-3 text-xs text-muted-foreground">
              <Icon name="shield" size={16} className="mt-px shrink-0 text-navy" />
              {t('mfaNote')}
            </p>
            <div className="min-h-4 flex-1" />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t('borrowerLink')}{' '}
              <Link className="font-semibold text-navy underline-offset-4 hover:underline" href={AppPath.Login}>
                {t('borrowerCta')}
              </Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
