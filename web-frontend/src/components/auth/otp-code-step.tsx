'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { StepHeader } from '@/components/ui/step-header';
import { OTP_LENGTH } from '@/lib/constants/auth.constants';

type Props = {
  destination: string;
  resendIn: number;
  pending: boolean;
  error: string | null;
  attempt: number;
  onVerify: (code: string) => void;
  onResend: () => void;
  onChangeDestination: () => void;
  title?: string;
  submitLabel?: string;
};

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);
const SECONDS_PER_MINUTE = 60;

const clock = (seconds: number) => `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;

export function OtpCodeStep({ destination, resendIn, pending, error, attempt, onVerify, onResend, onChangeDestination, title, submitLabel }: Props) {
  const t = useTranslations('auth.otp');
  const [code, setCode] = useState('');
  const [seenAttempt, setSeenAttempt] = useState(attempt);
  const [resendAt, setResendAt] = useState(() => Date.now() + resendIn * 1000);
  const [now, setNow] = useState(() => Date.now());
  if (attempt !== seenAttempt) {
    setSeenAttempt(attempt);
    setCode('');
  }
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === OTP_LENGTH) onVerify(code);
      }}
    >
      <StepHeader onBack={onChangeDestination} className="-mt-2" />
      <h2 className="mt-2 font-heading text-2xl leading-8 font-semibold tracking-[-0.01em] text-foreground">{title ?? t('title')}</h2>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <span className="tabular">{t('sentTo', { destination })}</span>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onChangeDestination} className="font-semibold text-navy underline underline-offset-2">
          {t('change')}
        </button>
      </p>
      <div className="mt-4 pt-4">
        <InputOTP maxLength={OTP_LENGTH} value={code} onChange={setCode} onComplete={onVerify} autoComplete="one-time-code" inputMode="numeric" autoFocus aria-label={t('code')} aria-invalid={Boolean(error)} disabled={pending}>
          <InputOTPGroup key={attempt}>
            {SLOTS.map((index) => (
              <InputOTPSlot key={index} index={index} aria-invalid={Boolean(error)} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <AnimatePresence>
        {error ? (
          <motion.p key={`error-${attempt}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex items-center gap-1.5 text-[13px] text-destructive" role="alert">
            <Icon name="error" size={15} />
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <div className="mt-4 min-h-6 text-sm">
        {secondsLeft > 0 ? (
          <span className="text-muted-foreground">
            {t('resendIn')} <span className="font-semibold text-navy tabular">{clock(secondsLeft)}</span>
          </span>
        ) : (
          <button
            type="button"
            className="font-semibold text-navy underline-offset-4 hover:underline"
            disabled={pending}
            onClick={() => {
              setResendAt(Date.now() + resendIn * 1000);
              onResend();
            }}
          >
            {t('resend')}
          </button>
        )}
      </div>
      <div className="min-h-4 flex-1" />
      <Button type="submit" className="mt-4 w-full" disabled={pending || code.length !== OTP_LENGTH}>
        {pending ? <Spinner /> : null}
        {pending ? t('verifying') : (submitLabel ?? t('verify'))}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">{t('terms')}</p>
    </form>
  );
}
