'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { KeyValues, Section } from '@/components/data/detail-section';
import { StatusBadge } from '@/components/data/status-badge';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText } from '@/hooks/use-error-toast';
import { usePartnerOwner } from '@/hooks/use-partner-owner';
import { ApiError } from '@/lib/api/api-error';
import { partnerKeys, partnerProfileQuery, updatePartnerProfile } from '@/lib/api/partners';
import type { PartnerKycInput, PartnerProfile } from '@/lib/api/types/partner.types';
import { PAN_PATTERN } from '@/lib/constants/kyc.constants';
import { BANK_ACCOUNT_PATTERN, GSTIN_PATTERN, IFSC_PATTERN, REGISTRATION_NUMBER_PATTERN } from '@/lib/constants/partner.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';

const upper = (value: string) => value.trim().toUpperCase();

function KycForm({ profile }: { profile: PartnerProfile }) {
  const t = useTranslations('partner.profile');
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [membershipNumber, setMembershipNumber] = useState(profile.membershipNumber ?? '');
  const [firmRegistration, setFirmRegistration] = useState(profile.firmRegistrationNumber ?? '');
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holder, setHolder] = useState('');
  const [error, setError] = useState<{ path: string | null; message: string } | null>(null);
  const bankGiven = account !== '' || ifsc !== '' || holder !== '';
  const issues = {
    membershipNumber: membershipNumber.trim() !== '' && !REGISTRATION_NUMBER_PATTERN.test(membershipNumber.trim()),
    firmRegistration: firmRegistration.trim() !== '' && !REGISTRATION_NUMBER_PATTERN.test(firmRegistration.trim()),
    pan: pan !== '' && !PAN_PATTERN.test(upper(pan)),
    gstin: gstin !== '' && !GSTIN_PATTERN.test(upper(gstin)),
    bank: bankGiven && (!BANK_ACCOUNT_PATTERN.test(account.trim()) || !IFSC_PATTERN.test(upper(ifsc)) || holder.trim().length < 2),
  };
  const body: PartnerKycInput = {
    ...(membershipNumber.trim() && membershipNumber.trim() !== profile.membershipNumber ? { membershipNumber: membershipNumber.trim() } : {}),
    ...(firmRegistration.trim() && firmRegistration.trim() !== profile.firmRegistrationNumber ? { firmRegistrationNumber: firmRegistration.trim() } : {}),
    ...(pan ? { pan: upper(pan) } : {}),
    ...(gstin ? { gstin: upper(gstin) } : {}),
    ...(bankGiven ? { bankAccount: { accountNumber: account.trim(), ifsc: upper(ifsc), holderName: holder.trim() } } : {}),
  };
  const valid = Object.values(issues).every((issue) => !issue) && Object.keys(body).length > 0;
  const save = useMutation({
    mutationFn: () => updatePartnerProfile(body, profile.version),
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(partnerKeys.profile(), next);
      void queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success(t('saved'));
      setPan('');
      setGstin('');
      setAccount('');
      setIfsc('');
      setHolder('');
    },
    onError: (failure) => {
      const issue = failure instanceof ApiError ? failure.fieldIssues[0] : undefined;
      setError({ path: issue?.path ?? null, message: errorText(failure) });
    },
  });
  const fieldError = (path: string) => (error?.path?.startsWith(path) ? <FieldError>{error.message}</FieldError> : null);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={issues.membershipNumber}>
          <FieldLabel htmlFor="kyc-membership">{t('membershipNumber')}</FieldLabel>
          <Input id="kyc-membership" value={membershipNumber} maxLength={30} onChange={(event) => setMembershipNumber(event.target.value)} aria-invalid={issues.membershipNumber} />
          {fieldError('membershipNumber')}
        </Field>
        <Field data-invalid={issues.firmRegistration}>
          <FieldLabel htmlFor="kyc-firm">{t('firmRegistration')}</FieldLabel>
          <Input id="kyc-firm" value={firmRegistration} maxLength={30} onChange={(event) => setFirmRegistration(event.target.value)} aria-invalid={issues.firmRegistration} />
          {fieldError('firmRegistrationNumber')}
        </Field>
        <Field data-invalid={issues.pan}>
          <FieldLabel htmlFor="kyc-pan">{t('pan')}</FieldLabel>
          <Input id="kyc-pan" value={pan} maxLength={10} autoCapitalize="characters" placeholder={profile.kyc.pan?.masked ?? undefined} onChange={(event) => setPan(event.target.value)} aria-invalid={issues.pan} />
          <FieldDescription>{profile.kyc.pan ? t('onFile', { value: profile.kyc.pan.masked }) : t('panHint')}</FieldDescription>
          {fieldError('pan')}
        </Field>
        <Field data-invalid={issues.gstin}>
          <FieldLabel htmlFor="kyc-gstin">{t('gstin')}</FieldLabel>
          <Input id="kyc-gstin" value={gstin} maxLength={15} autoCapitalize="characters" placeholder={profile.kyc.gstin?.masked ?? undefined} onChange={(event) => setGstin(event.target.value)} aria-invalid={issues.gstin} />
          <FieldDescription>{profile.kyc.gstin ? t('onFile', { value: profile.kyc.gstin.masked }) : t('gstinHint')}</FieldDescription>
          {fieldError('gstin')}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3 rounded-lg border border-subtle p-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">{t('bank')}</legend>
        {profile.kyc.bank ? <p className="text-xs text-muted-foreground">{t('bankOnFile', { last4: profile.kyc.bank.accountLast4, ifsc: profile.kyc.bank.ifsc ?? '—' })}</p> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field data-invalid={issues.bank && !BANK_ACCOUNT_PATTERN.test(account.trim())}>
            <FieldLabel htmlFor="kyc-account">{t('accountNumber')}</FieldLabel>
            <Input id="kyc-account" inputMode="numeric" value={account} maxLength={18} onChange={(event) => setAccount(event.target.value.replaceAll(/\D/g, ''))} />
          </Field>
          <Field data-invalid={issues.bank && !IFSC_PATTERN.test(upper(ifsc))}>
            <FieldLabel htmlFor="kyc-ifsc">{t('ifsc')}</FieldLabel>
            <Input id="kyc-ifsc" value={ifsc} maxLength={11} autoCapitalize="characters" onChange={(event) => setIfsc(event.target.value)} />
          </Field>
          <Field data-invalid={issues.bank && holder.trim().length < 2}>
            <FieldLabel htmlFor="kyc-holder">{t('holderName')}</FieldLabel>
            <Input id="kyc-holder" value={holder} maxLength={120} onChange={(event) => setHolder(event.target.value)} />
          </Field>
        </div>
        {fieldError('bankAccount')}
      </fieldset>
      {error && !error.path ? <p className="text-xs text-destructive" role="alert">{error.message}</p> : null}
      <Button
        size="sm"
        className="self-start"
        disabled={!valid || save.isPending}
        onClick={() => {
          setError(null);
          save.mutate();
        }}
      >
        {save.isPending ? <Spinner /> : null}
        {t('save')}
      </Button>
    </div>
  );
}

export function PartnerProfileScreen() {
  const t = useTranslations('partner.profile');
  const tKinds = useTranslations('partner.signup.kinds');
  const tStatus = useTranslations('status');
  const locale = useLocale();
  const { owner } = usePartnerOwner();
  const profile = useQuery(partnerProfileQuery());
  if (profile.isPending) return <ScreenSkeleton />;
  if (!profile.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  const data = profile.data;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={data.name} description={tKinds.has(data.kind) ? tKinds(data.kind) : data.kind} badge={<StatusBadge status={data.verification.status} tone={toneOf(REVIEW_STATUS_TONE, data.verification.status)} />} />
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <Section title={t('firm')}>
          <KeyValues
            columns={1}
            items={[
              { label: t('level'), value: t.has(`levels.${data.level}`) ? t(`levels.${data.level}`) : data.level },
              { label: t('membershipNumber'), value: data.membershipNumber ?? '—' },
              { label: t('firmRegistration'), value: data.firmRegistrationNumber ?? '—' },
              { label: t('kycStatus'), value: tStatus.has(data.kyc.status) ? tStatus(data.kyc.status) : data.kyc.status },
              { label: t('joined'), value: formatDate(data.createdAt, locale) },
            ]}
          />
        </Section>
        <Section title={t('kyc')} delay={0.04}>
          <p className="text-sm text-muted-foreground">{t('kycBody')}</p>
          {owner ? <KycForm key={data.version} profile={data} /> : <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>}
        </Section>
      </div>
    </div>
  );
}
