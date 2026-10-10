'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { OTP_LENGTH } from '@/lib/constants/auth.constants';

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);

export function OtpDialog({ open, onOpenChange, destination, pending, error, onVerify }: { open: boolean; onOpenChange: (open: boolean) => void; destination: string; pending: boolean; error: string | null; onVerify: (code: string) => void }) {
  const t = useTranslations('account.security');
  const tAuth = useTranslations('auth.otp');
  const [code, setCode] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCode('');
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('verifyTitle')}</DialogTitle>
          <DialogDescription>{t('verifyBody', { destination })}</DialogDescription>
        </DialogHeader>
        <InputOTP maxLength={OTP_LENGTH} value={code} onChange={setCode} onComplete={onVerify} inputMode="numeric" autoComplete="one-time-code" autoFocus disabled={pending}>
          <InputOTPGroup>
            {SLOTS.map((index) => (
              <InputOTPSlot key={index} index={index} aria-invalid={Boolean(error)} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          <Button onClick={() => onVerify(code)} disabled={pending || code.length !== OTP_LENGTH}>
            {pending ? <Spinner /> : null}
            {tAuth('verify')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
