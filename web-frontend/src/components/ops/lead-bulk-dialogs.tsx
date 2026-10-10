'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { ChoiceRow } from '@/components/ui/choice';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MobileInput } from '@/components/ui/mobile-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { bulkAssignLeads, createOpsLead, mergeLeads, opsLeadKeys, verifiedPartnersQuery } from '@/lib/api/leads';
import type { OpsLead } from '@/lib/api/types/lead.types';
import { DEFAULT_COUNTRY_CODE, INDIAN_MOBILE_PATTERN } from '@/lib/constants/auth.constants';
import { NAME_MIN_LENGTH } from '@/lib/constants/kyc.constants';
import { LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH, OPS_CONSENT_EVIDENCE_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';

const CONTACT_PURPOSE = 'contact';
const CONSENT_BASIS = 'consent';

export function BulkAssignDialog({ leadIds, open, onOpenChange, onDone }: { leadIds: string[]; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const t = useTranslations('ops.leads');
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const noteId = useId();
  const partners = useQuery({ ...verifiedPartnersQuery(), enabled: open });
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const options = (partners.data?.items ?? []).filter((partner) => partner.organizationStatus === 'active');
  const assign = useMutation({
    mutationFn: () => bulkAssignLeads(leadIds, organizationId ?? '', note.trim() || undefined),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('bulkAssigned', { count: leadIds.length }));
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
      onDone();
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('bulkAssignTitle', { count: leadIds.length })} confirmLabel={t('assign')} pending={assign.isPending} confirmDisabled={!organizationId || (note.trim().length > 0 && note.trim().length < LEAD_NOTE_MIN_LENGTH)} onConfirm={() => assign.mutate()}>
      <Field>
        <FieldLabel>{t('partnerFirm')}</FieldLabel>
        <Select value={organizationId} onValueChange={(value) => setOrganizationId(String(value))}>
          <SelectTrigger size="sm" className="h-11 w-full" aria-label={t('partnerFirm')}>
            <SelectValue>{(current: string | null) => options.find((partner) => partner.organizationId === current)?.name ?? t('choosePartner')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((partner) => (
              <SelectItem key={partner.organizationId} value={partner.organizationId}>
                {partner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={noteId}>{t('noteOptional')}</FieldLabel>
        <Textarea id={noteId} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

export function MergeLeadsDialog({ leads, open, onOpenChange, onDone }: { leads: OpsLead[]; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const t = useTranslations('ops.leads');
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const noteId = useId();
  const [survivor, setSurvivor] = useState<string | null>(leads[0]?.id ?? null);
  const [note, setNote] = useState('');
  const merge = useMutation({
    mutationFn: () => mergeLeads(survivor ?? '', leads.filter((lead) => lead.id !== survivor).map((lead) => lead.id), note.trim()),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('merged'));
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
      onDone();
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('mergeTitle')} description={t('mergeBody')} confirmLabel={t('merge')} pending={merge.isPending} confirmDisabled={!survivor || note.trim().length < LEAD_NOTE_MIN_LENGTH} onConfirm={() => merge.mutate()}>
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-foreground">{t('keep')}</legend>
        {leads.map((lead) => (
          <ChoiceRow key={lead.id} selected={survivor === lead.id} onSelect={() => setSurvivor(lead.id)} icon="person" title={lead.party?.displayName ?? lead.ref} description={`${lead.ref} · ${lead.amount.text ?? '—'}`} />
        ))}
      </fieldset>
      <Field>
        <FieldLabel htmlFor={noteId}>{t('mergeNote')}</FieldLabel>
        <Textarea id={noteId} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

export function NewLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.leads');
  const errorToast = useErrorToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const nameId = useId();
  const mobileId = useId();
  const businessId = useId();
  const amountId = useId();
  const cityId = useId();
  const campaignId = useId();
  const evidenceId = useId();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [business, setBusiness] = useState('');
  const [amount, setAmount] = useState('');
  const [city, setCity] = useState('');
  const [campaign, setCampaign] = useState('');
  const [consented, setConsented] = useState(false);
  const [evidence, setEvidence] = useState('');
  const valid = name.trim().length >= NAME_MIN_LENGTH && INDIAN_MOBILE_PATTERN.test(mobile) && (!consented || evidence.trim().length >= OPS_CONSENT_EVIDENCE_MIN_LENGTH);
  const create = useMutation({
    mutationFn: () =>
      createOpsLead({
        name: name.trim(),
        mobile,
        countryCode: DEFAULT_COUNTRY_CODE,
        ...(business.trim() ? { businessName: business.trim() } : {}),
        ...(amount.trim() ? { amountText: amount.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(campaign.trim() ? { campaign: campaign.trim() } : {}),
        ...(consented ? { consent: { basis: CONSENT_BASIS, evidence: evidence.trim(), items: [{ purpose: CONTACT_PURPOSE, granted: true }] } } : {}),
      }),
    meta: { handlesError: true },
    onSuccess: (lead) => {
      toast.success(t('created', { ref: lead.ref }));
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
      onOpenChange(false);
      router.push(RoutePath.opsLead(lead.id));
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('newTitle')} description={t('newBody')} confirmLabel={t('create')} pending={create.isPending} confirmDisabled={!valid} onConfirm={() => create.mutate()}>
      <Field>
        <FieldLabel htmlFor={nameId}>{t('fullName')}</FieldLabel>
        <Input id={nameId} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      </Field>
      <Field>
        <FieldLabel htmlFor={mobileId}>{t('mobile')}</FieldLabel>
        <MobileInput id={mobileId} value={mobile} onValueChange={setMobile} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={businessId}>{t('businessName')}</FieldLabel>
          <Input id={businessId} value={business} maxLength={160} onChange={(event) => setBusiness(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={amountId}>{t('amountText')}</FieldLabel>
          <Input id={amountId} value={amount} maxLength={60} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={cityId}>{t('city')}</FieldLabel>
          <Input id={cityId} value={city} maxLength={80} onChange={(event) => setCity(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={campaignId}>{t('campaign')}</FieldLabel>
          <Input id={campaignId} value={campaign} maxLength={100} onChange={(event) => setCampaign(event.target.value)} />
        </Field>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
        {t('consentOnCall')}
        <Switch checked={consented} onCheckedChange={setConsented} />
      </label>
      {consented ? (
        <Field>
          <FieldLabel htmlFor={evidenceId}>{t('consentEvidence')}</FieldLabel>
          <Textarea id={evidenceId} rows={2} value={evidence} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setEvidence(event.target.value)} />
          <FieldDescription>{t('consentEvidenceHint')}</FieldDescription>
        </Field>
      ) : null}
    </ConfirmDialog>
  );
}
