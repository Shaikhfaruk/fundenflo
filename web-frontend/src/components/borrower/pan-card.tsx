'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText } from '@/hooks/use-error-toast';
import { ApiError } from '@/lib/api/api-error';
import { borrowerKeys, verifyPan } from '@/lib/api/borrowers';
import type { BorrowerProfile } from '@/lib/api/types/borrower.types';
import { NAME_MIN_LENGTH, PAN_LENGTH, PAN_PATTERN, PanHolder } from '@/lib/constants/kyc.constants';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { StatusTone } from '@/lib/constants/status.constants';
import { formatDate, todayIsoDate } from '@/lib/format/date';
import { useMe } from '@/lib/session/use-me';
import { cn } from '@/lib/utils';

export function PanCard({ profile, onVerified, className }: { profile: BorrowerProfile; onVerified?: () => void; className?: string }) {
  const t = useTranslations('borrower.profile');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const { data: me } = useMe();
  const holder = profile.kyc?.panHolder ?? null;
  const person = holder === PanHolder.Person;
  const defaultName = (person ? (me?.fullName ?? profile.actingParty.displayName) : profile.party.displayName) ?? '';
  const [pan, setPan] = useState('');
  const [name, setName] = useState(defaultName);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [issue, setIssue] = useState<string | null>(null);
  const verify = useMutation({
    mutationFn: () => verifyPan(profile.id, { pan, name: name.trim() || undefined, dateOfBirth: dateOfBirth || undefined }),
    meta: { handlesError: true },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: borrowerKeys.detail(profile.id) });
      setIssue(null);
      if (result.verified) {
        toast.success(t('panVerified'));
        onVerified?.();
      } else toast.warning(t('panNameMismatch'));
    },
    onError: (failure) => setIssue(failure instanceof ApiError && failure.fieldIssues[0] ? failure.fieldIssues[0].message : errorText(failure)),
  });
  const onRecord = profile.kyc?.pan;
  return (
    <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: Duration.Slow, ease: EASE_OUT }} className={cn('flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-lg font-semibold text-navy">{person ? t('panPersonal') : t('panBusiness')}</h2>
          <p className="text-xs text-muted-foreground">{t('panBody')}</p>
        </div>
        <IconTile icon="id-card" tone={onRecord?.verified ? 'success' : 'goldSoft'} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {onRecord?.verified ? (
          <motion.div key="verified" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-lg bg-success-soft px-3.5 py-3">
            <Icon name="verified" size={22} className="text-success" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-heading text-base font-semibold tracking-[0.12em] text-navy tabular">{onRecord.masked}</span>
              {onRecord.verifiedAt ? <span className="text-xs text-success">{t('verifiedOn', { date: formatDate(onRecord.verifiedAt, locale) })}</span> : null}
            </div>
            <StatusBadge status="verified" tone={StatusTone.Success} />
          </motion.div>
        ) : !holder ? (
          <motion.p key="type" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 rounded-lg bg-gold-soft px-3 py-2.5 text-[13px] text-[#5d4200]">
            <Icon name="info" size={16} className="mt-0.5 shrink-0 text-gold-ink" />
            {t('panNeedsType')}
          </motion.p>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            {onRecord && !onRecord.verified ? <p className="text-xs text-gold-ink">{t('panUnverified', { pan: onRecord.masked })}</p> : null}
            <Field data-invalid={Boolean(issue)}>
              <FieldLabel htmlFor="pan">{t('panNumber')}</FieldLabel>
              <Input id="pan" value={pan} onChange={(event) => setPan(event.target.value.replaceAll(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, PAN_LENGTH))} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={t('panPlaceholder')} className="font-heading tracking-[0.18em] uppercase" aria-invalid={Boolean(issue)} />
              <FieldDescription>{t('panHint', { letter: holder })}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="pan-name">{t('panName')}</FieldLabel>
              <Input id="pan-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete={person ? 'name' : 'organization'} />
            </Field>
            {person ? (
              <Field>
                <FieldLabel htmlFor="pan-dob">{t('dateOfBirth')}</FieldLabel>
                <Input id="pan-dob" type="date" max={todayIsoDate()} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} autoComplete="bday" />
                <FieldDescription>{t('optional')}</FieldDescription>
              </Field>
            ) : null}
            {issue ? <FieldError>{issue}</FieldError> : null}
            <Button className="w-full" disabled={!PAN_PATTERN.test(pan) || name.trim().length < NAME_MIN_LENGTH || verify.isPending} onClick={() => verify.mutate()}>
              {verify.isPending ? <Spinner /> : <Icon name="verified" size={18} />}
              {t('verifyPan')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
