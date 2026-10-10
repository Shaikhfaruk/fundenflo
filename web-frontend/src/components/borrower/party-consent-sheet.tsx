'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useErrorText } from '@/hooks/use-error-toast';
import { ApiError } from '@/lib/api/api-error';
import { applicationKeys } from '@/lib/api/applications';
import { confirmPartyConsent, journeyKeys } from '@/lib/api/journey';
import type { ApplicationParty } from '@/lib/api/types/application.types';
import type { ConsentOtpChallenge } from '@/lib/api/types/consent.types';
import { OTP_LENGTH } from '@/lib/constants/auth.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);
const CODE_ERRORS: readonly string[] = [ErrorCode.OtpInvalid, ErrorCode.OtpExpired, ErrorCode.OtpLocked];

function ConsentCode({ applicationId, party, challenge, onResend, resending, onDone }: { applicationId: string; party: ApplicationParty; challenge: ConsentOtpChallenge; onResend: () => void; resending: boolean; onDone: () => void }) {
  const t = useTranslations('flow.people.consent');
  const errorText = useErrorText();
  const queryClient = useQueryClient();
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
  const confirm = useMutation({
    mutationFn: (value: string) => confirmPartyConsent(applicationId, party.id, { challengeId: challenge.challengeId, code: value, items: challenge.template.items.map((item) => ({ purpose: item.purpose, granted: choices[item.purpose] ?? false })) }),
    meta: { handlesError: true },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: journeyKeys.parties(applicationId) });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      if (result.missingRequired.length === 0) toast.success(t('granted', { name: party.party.displayName ?? '' }));
      else toast.warning(t('declined', { name: party.party.displayName ?? '' }));
      onDone();
    },
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
        <Icon name="sms" size={18} className="shrink-0 text-gold-deep" />
        <span>{t('sent', { recipient: challenge.recipient })}</span>
      </p>
      <div className="flex flex-col gap-2">
        {challenge.template.items.map((item) => (
          <ToggleRow key={item.purpose} title={item.title} description={item.summary} checked={choices[item.purpose] ?? false} onCheckedChange={(checked) => setChoices((current) => ({ ...current, [item.purpose]: checked }))} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{t('codeLabel', { name: party.party.displayName ?? '' })}</p>
        <InputOTP maxLength={OTP_LENGTH} value={code} onChange={setCode} onComplete={(value: string) => confirm.mutate(value)} inputMode="numeric" autoComplete="one-time-code" aria-label={t('codeLabel', { name: party.party.displayName ?? '' })} aria-invalid={Boolean(error)} disabled={confirm.isPending}>
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
      <Button className="w-full" disabled={code.length !== OTP_LENGTH || confirm.isPending} onClick={() => confirm.mutate(code)}>
        {confirm.isPending ? <Spinner /> : null}
        {t('confirm')}
      </Button>
    </div>
  );
}

export type ConsentTarget = { party: ApplicationParty; challenge: ConsentOtpChallenge };

export function PartyConsentSheet({ applicationId, target, resending, onResend, onOpenChange }: { applicationId: string; target: ConsentTarget | null; resending: boolean; onResend: (party: ApplicationParty) => void; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('flow.people.consent');
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] w-full max-w-[560px] gap-4 overflow-y-auto px-4 pt-4 pb-4 safe-bottom">
        <span className="mx-auto h-1 w-10 rounded-full bg-[#e7e8eb]" aria-hidden="true" />
        <SheetHeader className="p-0">
          <SheetTitle className="font-heading text-lg font-semibold text-navy">{t('title', { name: target?.party.party.displayName ?? '' })}</SheetTitle>
          <SheetDescription>{t('body')}</SheetDescription>
        </SheetHeader>
        {target ? <ConsentCode key={target.challenge.challengeId} applicationId={applicationId} party={target.party} challenge={target.challenge} resending={resending} onResend={() => onResend(target.party)} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}
