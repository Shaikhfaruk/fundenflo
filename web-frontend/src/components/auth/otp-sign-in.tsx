'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { OtpCodeStep } from '@/components/auth/otp-code-step';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { requestOtp } from '@/lib/api/auth';
import { DEFAULT_COUNTRY_CODE, LoginAs } from '@/lib/constants/auth.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import { NEXT_PARAM } from '@/lib/constants/routes.constants';
import { currentDevice } from '@/lib/device';
import { applyFieldErrors } from '@/lib/forms/field-errors';
import { destinationAfterSignIn } from '@/lib/session/after-sign-in';
import { verifyOtp } from '@/lib/session/client-session';

const SIGN_IN_ROLES = [LoginAs.Borrower, LoginAs.Ca, LoginAs.Dsa] as const;
const ROLE_LABEL = { [LoginAs.Borrower]: 'asBorrower', [LoginAs.Ca]: 'asCa', [LoginAs.Dsa]: 'asDsa' } as const;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const CODE_ERRORS: readonly string[] = [ErrorCode.OtpInvalid, ErrorCode.OtpExpired, ErrorCode.OtpLocked];

const CHANNELS = ['mobile', 'email'] as const;

const buildSchema = (t: (key: string) => string) =>
  z
    .object({
      channel: z.enum(CHANNELS),
      loginAs: z.enum(SIGN_IN_ROLES),
      mobile: z.string().trim(),
      email: z.string().trim(),
      referralCode: z.string().trim().max(24),
    })
    .superRefine((values, context) => {
      if (values.channel === 'mobile' && !INDIAN_MOBILE.test(values.mobile)) context.addIssue({ code: 'custom', path: ['mobile'], message: t('MOBILE_INVALID') });
      if (values.channel === 'email' && !z.email().safeParse(values.email).success) context.addIssue({ code: 'custom', path: ['email'], message: t('EMAIL_INVALID') });
    });

type Values = z.infer<ReturnType<typeof buildSchema>>;

type Challenge = { challengeId: string; resendIn: number; destination: string; values: Values };

export function OtpSignIn() {
  const t = useTranslations('auth.login');
  const tErrors = useTranslations('errors');
  const toastError = useErrorToast();
  const errorText = useErrorText();
  const router = useRouter();
  const search = useSearchParams();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const presetRole = SIGN_IN_ROLES.find((role) => role === search.get('as')) ?? LoginAs.Borrower;
  const form = useForm<Values>({
    resolver: zodResolver(buildSchema(tErrors)),
    defaultValues: { channel: 'mobile', loginAs: presetRole, mobile: '', email: '', referralCode: search.get('ref') ?? '' },
  });
  const channel = useWatch({ control: form.control, name: 'channel' });

  const identifier = (values: Values) => (values.channel === 'mobile' ? { mobile: values.mobile, countryCode: DEFAULT_COUNTRY_CODE } : { email: values.email });

  const send = useMutation({
    mutationFn: (values: Values) => requestOtp({ ...identifier(values), loginAs: values.loginAs, referralCode: values.referralCode || undefined }),
    meta: { handlesError: true },
    onSuccess: (issued, values) => {
      setCodeError(null);
      setChallenge({ challengeId: issued.challengeId, resendIn: issued.resendIn, destination: values.channel === 'mobile' ? `${DEFAULT_COUNTRY_CODE} ${values.mobile}` : values.email, values });
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, ['mobile', 'email', 'referralCode', 'loginAs'])) toastError(error);
    },
  });

  const verify = useMutation({
    mutationFn: (code: string) => {
      if (!challenge) throw new Error('No code requested');
      return verifyOtp({ ...identifier(challenge.values), otp: code, challengeId: challenge.challengeId, device: currentDevice() });
    },
    meta: { handlesError: true },
    onSuccess: (payload) => router.replace(destinationAfterSignIn(payload, search.get(NEXT_PARAM))),
    onError: (error) => {
      if (error instanceof ApiError && CODE_ERRORS.includes(error.code)) setCodeError(errorText(error));
      else toastError(error);
    },
  });

  if (challenge) {
    return (
      <OtpCodeStep
        key={challenge.challengeId}
        destination={challenge.destination}
        resendIn={challenge.resendIn}
        pending={verify.isPending}
        error={codeError}
        onVerify={(code) => verify.mutate(code)}
        onChangeDestination={() => setChallenge(null)}
        onResend={() =>
          send.mutate(challenge.values, {
            onSuccess: () => toast.success(t('sent')),
          })
        }
      />
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => send.mutate(values))} noValidate>
      <FieldGroup>
        <Controller
          control={form.control}
          name="loginAs"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend variant="label">{t('as')}</FieldLegend>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SIGN_IN_ROLES.map((role) => (
                  <FieldLabel key={role} htmlFor={`as-${role}`}>
                    <Field orientation="horizontal">
                      <RadioGroupItem value={role} id={`as-${role}`} />
                      <span className="text-sm">{t(ROLE_LABEL[role])}</span>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          )}
        />
        {channel === 'mobile' ? (
          <Field data-invalid={Boolean(form.formState.errors.mobile)}>
            <FieldLabel htmlFor="mobile">{t('mobile')}</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="flex h-10 items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground md:h-9">{DEFAULT_COUNTRY_CODE}</span>
              <Input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} aria-invalid={Boolean(form.formState.errors.mobile)} {...form.register('mobile')} />
            </div>
            <FieldError errors={[form.formState.errors.mobile]} />
          </Field>
        ) : (
          <Field data-invalid={Boolean(form.formState.errors.email)}>
            <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
            <Input id="email" type="email" inputMode="email" autoComplete="email" aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>
        )}
        <Button type="button" variant="link" className="h-auto self-start p-0" onClick={() => form.setValue('channel', channel === 'mobile' ? 'email' : 'mobile')}>
          {channel === 'mobile' ? t('useEmail') : t('useMobile')}
        </Button>
        <Field data-invalid={Boolean(form.formState.errors.referralCode)}>
          <FieldLabel htmlFor="referralCode">
            {t('referralCode')} <span className="font-normal text-muted-foreground">({t('optional')})</span>
          </FieldLabel>
          <Input id="referralCode" autoCapitalize="characters" autoComplete="off" {...form.register('referralCode')} />
          <FieldDescription>{t('referralHint')}</FieldDescription>
          <FieldError errors={[form.formState.errors.referralCode]} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={send.isPending}>
        {send.isPending ? <Spinner /> : null}
        {send.isPending ? t('sending') : t('sendCode')}
      </Button>
      <p className="text-xs text-muted-foreground">{t('terms')}</p>
    </form>
  );
}
