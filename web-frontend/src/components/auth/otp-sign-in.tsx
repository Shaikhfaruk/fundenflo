'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { OtpCodeStep } from '@/components/auth/otp-code-step';
import { RolePicker } from '@/components/auth/role-picker';
import { AuthShell } from '@/components/shell/auth-shell';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileInput } from '@/components/ui/mobile-input';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { requestOtp } from '@/lib/api/auth';
import { DEFAULT_COUNTRY_CODE, INDIAN_MOBILE_PATTERN, LoginAs, REFERRAL_CODE_MAX_LENGTH, REFERRAL_CODE_PATTERN } from '@/lib/constants/auth.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { AppPath, LOGIN_AS_PARAM, NEXT_PARAM } from '@/lib/constants/routes.constants';
import { currentDevice } from '@/lib/device';
import { applyFieldErrors } from '@/lib/forms/field-errors';
import { formatPhone } from '@/lib/format/phone';
import { destinationAfterSignIn } from '@/lib/session/after-sign-in';
import { verifyOtp } from '@/lib/session/client-session';

const OTP_ROLES = [LoginAs.Borrower, LoginAs.Ca, LoginAs.Dsa, LoginAs.Lender] as const;
const CODE_ERRORS: readonly string[] = [ErrorCode.OtpInvalid, ErrorCode.OtpExpired, ErrorCode.OtpLocked];
const CHANNELS = ['mobile', 'email'] as const;

const buildSchema = (t: (key: string) => string, tLogin: (key: string) => string) =>
  z
    .object({
      channel: z.enum(CHANNELS),
      loginAs: z.enum(OTP_ROLES),
      mobile: z.string().trim(),
      email: z.string().trim(),
      referralCode: z.string().trim().max(REFERRAL_CODE_MAX_LENGTH),
    })
    .superRefine((values, context) => {
      if (values.channel === 'mobile' && !INDIAN_MOBILE_PATTERN.test(values.mobile)) context.addIssue({ code: 'custom', path: ['mobile'], message: t('MOBILE_INVALID') });
      if (values.channel === 'email' && !z.email().safeParse(values.email).success) context.addIssue({ code: 'custom', path: ['email'], message: t('EMAIL_INVALID') });
      if (values.referralCode && !REFERRAL_CODE_PATTERN.test(values.referralCode)) context.addIssue({ code: 'custom', path: ['referralCode'], message: tLogin('referralInvalid') });
    });

type Values = z.infer<ReturnType<typeof buildSchema>>;

type Challenge = { challengeId: string; resendIn: number; destination: string; values: Values };

const SWAP = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: Duration.Base, ease: EASE_OUT } } as const;

export function OtpSignIn() {
  const t = useTranslations('auth.login');
  const tErrors = useTranslations('errors');
  const toastError = useErrorToast();
  const errorText = useErrorText();
  const router = useRouter();
  const search = useSearchParams();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [referralOpen, setReferralOpen] = useState(() => Boolean(search.get('ref')));
  const presetRole = OTP_ROLES.find((role) => role === search.get(LOGIN_AS_PARAM)) ?? LoginAs.Borrower;
  const form = useForm<Values>({
    resolver: zodResolver(buildSchema(tErrors, t)),
    defaultValues: { channel: presetRole === LoginAs.Lender ? 'email' : 'mobile', loginAs: presetRole, mobile: '', email: '', referralCode: search.get('ref')?.toUpperCase() ?? '' },
  });
  const channel = useWatch({ control: form.control, name: 'channel' });
  const mobile = useWatch({ control: form.control, name: 'mobile' });
  const referral = useWatch({ control: form.control, name: 'referralCode' });
  const errors = form.formState.errors;

  const identifier = (values: Values) => (values.channel === 'mobile' ? { mobile: values.mobile, countryCode: DEFAULT_COUNTRY_CODE } : { email: values.email });

  const send = useMutation({
    mutationFn: (values: Values) => requestOtp({ ...identifier(values), loginAs: values.loginAs, referralCode: values.referralCode || undefined }),
    meta: { handlesError: true },
    onSuccess: (issued, values) => {
      setCodeError(null);
      setChallenge({ challengeId: issued.challengeId, resendIn: issued.resendIn, destination: values.channel === 'mobile' ? formatPhone(`${DEFAULT_COUNTRY_CODE}${values.mobile}`) : values.email, values });
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
      if (error instanceof ApiError && CODE_ERRORS.includes(error.code)) {
        setCodeError(errorText(error));
        setAttempt((value) => value + 1);
      } else toastError(error);
    },
  });

  const mobileValid = INDIAN_MOBILE_PATTERN.test(mobile);

  return (
    <AuthShell headline={t('headline')} subline={t('subline')} compact={Boolean(challenge)}>
      <AnimatePresence mode="wait" initial={false}>
        {challenge ? (
          <motion.div key="code" {...SWAP} className="flex flex-1 flex-col">
            <OtpCodeStep
              key={challenge.challengeId}
              destination={challenge.destination}
              resendIn={challenge.resendIn}
              pending={verify.isPending}
              error={codeError}
              attempt={attempt}
              onVerify={(code) => verify.mutate(code)}
              onChangeDestination={() => setChallenge(null)}
              onResend={() => send.mutate(challenge.values, { onSuccess: () => toast.success(t('sent')) })}
            />
          </motion.div>
        ) : (
          <motion.form key="details" {...SWAP} className="flex flex-1 flex-col" onSubmit={form.handleSubmit((values) => send.mutate(values))} noValidate>
            <Label className="mb-2 text-sm font-medium text-foreground">{t('as')}</Label>
            <Controller
              control={form.control}
              name="loginAs"
              render={({ field }) => (
                <RolePicker
                  value={field.value}
                  onChange={(role) => {
                    field.onChange(role);
                    if (role === LoginAs.Lender) form.setValue('channel', 'email');
                  }}
                />
              )}
            />
            <div className="mt-4 mb-2 flex items-center justify-between gap-2">
              <Label htmlFor={channel} className="text-sm font-medium text-foreground">
                {channel === 'mobile' ? t('mobile') : t('email')}
              </Label>
              <button type="button" className="text-xs font-semibold text-navy underline-offset-4 hover:underline" onClick={() => form.setValue('channel', channel === 'mobile' ? 'email' : 'mobile')}>
                {channel === 'mobile' ? t('useEmail') : t('useMobile')}
              </button>
            </div>
            {channel === 'mobile' ? (
              <Controller
                control={form.control}
                name="mobile"
                render={({ field }) => <MobileInput id="mobile" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} valid={mobileValid} invalid={Boolean(errors.mobile)} placeholder={t('mobilePlaceholder')} />}
              />
            ) : (
              <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder={t('emailPlaceholder')} aria-invalid={Boolean(errors.email)} {...form.register('email')} />
            )}
            <AnimatePresence>
              {errors.mobile || errors.email ? (
                <motion.p key="field-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <Icon name="error" size={14} />
                  {errors.mobile?.message ?? errors.email?.message}
                </motion.p>
              ) : null}
            </AnimatePresence>
            <Button type="submit" className="mt-4 w-full" disabled={send.isPending || (channel === 'mobile' && !mobileValid)}>
              {send.isPending ? <Spinner /> : null}
              {send.isPending ? t('sending') : t('sendCode')}
              {send.isPending ? null : <Icon name="arrow-forward" size={18} />}
            </Button>
            <button type="button" aria-expanded={referralOpen} onClick={() => setReferralOpen((value) => !value)} className="mx-auto mt-2 flex min-h-11 items-center gap-1 text-sm font-medium text-gold-deep">
              {referral && !errors.referralCode && !referralOpen ? t('referralApplied', { code: referral }) : t('referralToggle')}
              <motion.span animate={{ rotate: referralOpen ? 180 : 0 }} className="flex">
                <Icon name="expand-more" size={16} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {referralOpen ? (
                <motion.div key="referral" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }} className="overflow-hidden">
                  <Input
                    aria-label={t('referralCode')}
                    placeholder={t('referralPlaceholder')}
                    autoCapitalize="characters"
                    autoComplete="off"
                    maxLength={REFERRAL_CODE_MAX_LENGTH}
                    className="h-12 tracking-[0.08em] uppercase"
                    aria-invalid={Boolean(errors.referralCode)}
                    {...form.register('referralCode', { setValueAs: (value: string) => value.replaceAll(/[^a-zA-Z0-9]/g, '').toUpperCase() })}
                  />
                  <FieldError className="mt-1.5 text-xs" errors={[errors.referralCode]} />
                  <p className="mt-1.5 text-xs text-muted-foreground">{t('referralHint')}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div className="min-h-4 flex-1" />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t('teamLink')}{' '}
              <Link className="font-semibold text-navy underline-offset-4 hover:underline" href={AppPath.StaffLogin}>
                {t('teamCta')}
              </Link>
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">{t('terms')}</p>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
