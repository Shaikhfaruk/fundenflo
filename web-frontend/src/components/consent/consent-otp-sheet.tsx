'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useErrorText } from '@/hooks/use-error-toast';
import { ApiError } from '@/lib/api/api-error';
import type { ConsentItemInput, ConsentOtpChallenge } from '@/lib/api/types/consent.types';
import { OTP_LENGTH } from '@/lib/constants/auth.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);
const CODE_ERRORS: readonly string[] = [ErrorCode.OtpInvalid, ErrorCode.OtpExpired, ErrorCode.OtpLocked];

export type ConsentOtpTarget = { name: string; challenge: ConsentOtpChallenge; grant?: ConsentItemInput[] };

type ConsentOtpConfirm = (body: { challengeId: string; code: string; items: ConsentItemInput[] }) => Promise<{ missingRequired: string[] }>;

type CodeProps = { target: ConsentOtpTarget; confirm: ConsentOtpConfirm; onResend: () => void; resending: boolean; onDone: (result: { missingRequired: string[] }) => void };

function ConsentCode({ target, confirm, onResend, resending, onDone }: CodeProps) {
  const t = useTranslations('consentOtp');
  const errorText = useErrorText();
  const { challenge, grant, name } = target;
  const [choices, setChoices] = useState<Record<string, boolean>>(() => Object.fromEntries(challenge.template.items.map((item) => [item.purpose, item.required])));
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [resendAt, setResendAt] = useState(() => Date.now() + challenge.resendIn * 1000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const items = grant ?? challenge.template.items.map((item) => ({ purpose: item.purpose, granted: choices[item.purpose] ?? false }));
  const granting = grant ? challenge.template.items.filter((item) => grant.some((entry) => entry.purpose === item.purpose && entry.granted)) : [];
  const submit = useMutation({
    mutationFn: (value: string) => confirm({ challengeId: challenge.challengeId, code: value, items }),
    meta: { handlesError: true },
    onSuccess: onDone,
    onError: (failure) => {
      setError(errorText(failure));
      if (failure instanceof ApiError && CODE_ERRORS.includes(failure.code)) {
        setCode('');
        setAttempt((value) => value + 1);
      }
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 rounded-lg bg-subtle px-3 py-2.5 text-sm text-navy">
        <Icon name="sms" size={18} className="shrink-0 text-gold-ink" />
        <span>{t('sent', { recipient: challenge.recipient })}</span>
      </p>
      {grant ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-navy">{t('granting', { name })}</h3>
          {granting.map((item) => (
            <div key={item.purpose} className="flex flex-col gap-0.5 rounded-lg border border-subtle p-3">
              <span className="text-sm font-semibold text-foreground">{item.title}</span>
              <span className="text-[13px]/5 text-muted-foreground">{item.details}</span>
            </div>
          ))}
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          {challenge.template.items.map((item) => (
            <ToggleRow key={item.purpose} title={item.title} description={item.summary} checked={choices[item.purpose] ?? false} onCheckedChange={(checked) => setChoices((current) => ({ ...current, [item.purpose]: checked }))} />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{t('codeLabel', { name })}</p>
        <InputOTP maxLength={OTP_LENGTH} value={code} onChange={setCode} onComplete={(value: string) => submit.mutate(value)} inputMode="numeric" autoComplete="one-time-code" aria-label={t('codeLabel', { name })} aria-invalid={Boolean(error)} disabled={submit.isPending}>
          <InputOTPGroup key={attempt}>
            {SLOTS.map((index) => (
              <InputOTPSlot key={index} index={index} aria-invalid={Boolean(error)} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error ? (
          <p className="flex items-center gap-1.5 text-[13px] text-destructive" role="alert">
            <Icon name="error" size={15} />
            {error}
          </p>
        ) : null}
        <div className="text-sm">
          {secondsLeft > 0 ? (
            <span className="text-muted-foreground">{t('resendIn', { seconds: secondsLeft })}</span>
          ) : (
            <button
              type="button"
              className="font-semibold text-navy underline-offset-4 hover:underline"
              disabled={resending}
              onClick={() => {
                setResendAt(Date.now() + challenge.resendIn * 1000);
                onResend();
              }}
            >
              {t('resend')}
            </button>
          )}
        </div>
      </div>
      <Button className="w-full" disabled={code.length !== OTP_LENGTH || submit.isPending} onClick={() => submit.mutate(code)}>
        {submit.isPending ? <Spinner /> : null}
        {t('confirm')}
      </Button>
    </div>
  );
}

type SheetProps = { target: ConsentOtpTarget | null; confirm: ConsentOtpConfirm; resending: boolean; onResend: () => void; onOpenChange: (open: boolean) => void; onConfirmed: (result: { missingRequired: string[] }) => void };

export function ConsentOtpSheet({ target, confirm, resending, onResend, onOpenChange, onConfirmed }: SheetProps) {
  const t = useTranslations('consentOtp');
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] w-full max-w-[560px] gap-4 overflow-y-auto px-4 pt-4 pb-4 safe-bottom">
        <span className="mx-auto h-1 w-10 rounded-full bg-[#e7e8eb]" aria-hidden="true" />
        <SheetHeader className="p-0">
          <SheetTitle className="font-heading text-lg font-semibold text-navy">{t('title', { name: target?.name ?? '' })}</SheetTitle>
          <SheetDescription>{target?.grant ? t('grantBody') : t('body')}</SheetDescription>
        </SheetHeader>
        {target ? (
          <ConsentCode
            key={target.challenge.challengeId}
            target={target}
            confirm={confirm}
            resending={resending}
            onResend={onResend}
            onDone={(result) => {
              onConfirmed(result);
              onOpenChange(false);
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
