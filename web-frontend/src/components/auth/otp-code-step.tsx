'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { OTP_LENGTH } from '@/lib/constants/auth.constants';

type Props = {
  destination: string;
  resendIn: number;
  pending: boolean;
  error: string | null;
  onVerify: (code: string) => void;
  onResend: () => void;
  onChangeDestination: () => void;
};

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);

export function OtpCodeStep({ destination, resendIn, pending, error, onVerify, onResend, onChangeDestination }: Props) {
  const t = useTranslations('auth.otp');
  const [code, setCode] = useState('');
  const [resendAt] = useState(() => Date.now() + resendIn * 1000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === OTP_LENGTH) onVerify(code);
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t('sentTo', { destination })}{' '}
        <Button type="button" variant="link" className="h-auto p-0" onClick={onChangeDestination}>
          {t('change')}
        </Button>
      </p>
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="otp">{t('code')}</FieldLabel>
        <InputOTP
          id="otp"
          maxLength={OTP_LENGTH}
          value={code}
          onChange={setCode}
          onComplete={onVerify}
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
          aria-invalid={Boolean(error)}
          disabled={pending}
        >
          <InputOTPGroup>
            {SLOTS.map((index) => (
              <InputOTPSlot key={index} index={index} aria-invalid={Boolean(error)} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <Button type="submit" size="lg" disabled={pending || code.length !== OTP_LENGTH}>
        {pending ? <Spinner /> : null}
        {pending ? t('verifying') : t('verify')}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        {secondsLeft > 0 ? (
          <span className="tabular">{t('resendIn', { seconds: secondsLeft })}</span>
        ) : (
          <Button type="button" variant="link" onClick={onResend} disabled={pending}>
            {t('resend')}
          </Button>
        )}
      </div>
    </form>
  );
}
