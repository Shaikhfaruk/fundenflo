'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { KeyValues, Section } from '@/components/data/detail-section';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { useTenureLabel } from '@/components/journey/use-tenure-label';
import { ActivityForm } from '@/components/leads/activity-form';
import { ActivityList } from '@/components/leads/activity-list';
import { FollowUpDialog } from '@/components/leads/follow-up-dialog';
import { LeadContacts } from '@/components/leads/lead-contacts';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link, useRouter } from '@/i18n/navigation';
import { applicationKeys } from '@/lib/api/applications';
import { segmentsQuery } from '@/lib/api/catalog';
import {
  acceptPartnerLead,
  convertPartnerLead,
  declinePartnerLead,
  logPartnerActivity,
  losePartnerLead,
  partnerLeadActivitiesQuery,
  partnerLeadKeys,
  partnerLeadQuery,
  reportOfflineConversion,
  returnPartnerLead,
  revealPartnerContact,
  schedulePartnerFollowUp,
  subAssignPartnerLead,
  updatePartnerLead,
} from '@/lib/api/partner-leads';
import { partnerKeys, partnerTeamQuery } from '@/lib/api/partners';
import type { LeadContact } from '@/lib/api/types/lead.types';
import type { PartnerLeadDetail } from '@/lib/api/types/partner-lead.types';
import { JourneyMode } from '@/lib/constants/journey.constants';
import { LEAD_LOST_REASONS, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH, LEAD_URGENCIES } from '@/lib/constants/ops.constants';
import { DECLINE_REASONS, MemberStatus, OTHER_REASON, PartnerLeadAction, RETURN_REASONS } from '@/lib/constants/partner.constants';
import { AppPath, JOURNEY_PATHS, resumePath } from '@/lib/constants/routes.constants';
import { LEAD_STATUS_TONE, REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime, formatRelative, todayIsoDate } from '@/lib/format/date';
import { formatPaise, paiseFromRupees, rupeesFromPaiseValue } from '@/lib/format/money';

type Reasoned = 'decline' | 'return' | 'lost';

const REASONS: Record<Reasoned, readonly string[]> = { decline: DECLINE_REASONS, return: RETURN_REASONS, lost: LEAD_LOST_REASONS };

const PARTNER_PATHS = JOURNEY_PATHS[JourneyMode.Partner];

const MAX_TENURE_MONTHS = 480;

const BUSINESS_SEGMENT = 'msme';

const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

function EditDialog({ lead, open, onOpenChange }: { lead: PartnerLeadDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('partner.leadDetail');
  const urgencyLabel = useEnumLabel('urgency');
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const amountId = useId();
  const tenureId = useId();
  const timeId = useId();
  const [amount, setAmount] = useState(lead.lead.amount.minPaise ? String(rupeesFromPaiseValue(lead.lead.amount.minPaise)) : '');
  const [tenure, setTenure] = useState(lead.lead.tenureMonths ? String(lead.lead.tenureMonths) : '');
  const [urgency, setUrgency] = useState<string | null>(lead.lead.urgency);
  const [contactTime, setContactTime] = useState(lead.lead.preferredContactTime ?? '');
  const amountValue = numberOrNull(amount);
  const tenureValue = numberOrNull(tenure);
  const valid = (amountValue === null || (Number.isFinite(amountValue) && amountValue > 0)) && (tenureValue === null || (Number.isInteger(tenureValue) && tenureValue >= 1 && tenureValue <= MAX_TENURE_MONTHS));
  const save = useMutation({
    mutationFn: () => {
      const paise = amountValue === null ? null : paiseFromRupees(amountValue);
      return updatePartnerLead(lead.lead.id, { amountMinPaise: paise, amountMaxPaise: paise, tenureMonths: tenureValue, urgency, preferredContactTime: contactTime.trim() || null }, lead.lead.version);
    },
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(partnerLeadKeys.detail(lead.lead.id), next);
      toast.success(t('saved'));
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('editTitle')} confirmLabel={t('save')} pending={save.isPending} confirmDisabled={!valid} onConfirm={() => save.mutate()}>
      <Field>
        <FieldLabel htmlFor={amountId}>{t('amountRupees')}</FieldLabel>
        <Input id={amountId} type="number" inputMode="numeric" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={tenureId}>{t('tenureMonths')}</FieldLabel>
        <Input id={tenureId} type="number" inputMode="numeric" min={1} max={MAX_TENURE_MONTHS} value={tenure} onChange={(event) => setTenure(event.target.value)} />
      </Field>
      <ChipGroup label={t('urgency')} showLabel>
        {LEAD_URGENCIES.map((value) => (
          <ChoiceChip key={value} selected={urgency === value} label={urgencyLabel(value)} onToggle={() => setUrgency(urgency === value ? null : value)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      <Field>
        <FieldLabel htmlFor={timeId}>{t('contactTime')}</FieldLabel>
        <Input id={timeId} value={contactTime} maxLength={60} onChange={(event) => setContactTime(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function ConversionDialog({ leadId, open, onOpenChange }: { leadId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('partner.leadDetail');
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const ids = { lender: useId(), sanctioned: useId(), sanctionedOn: useId(), disbursed: useId(), disbursedOn: useId(), account: useId(), note: useId() };
  const [today] = useState(todayIsoDate);
  const [lenderName, setLenderName] = useState('');
  const [sanctioned, setSanctioned] = useState('');
  const [sanctionedOn, setSanctionedOn] = useState('');
  const [disbursed, setDisbursed] = useState('');
  const [disbursedOn, setDisbursedOn] = useState('');
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const sanctionedValue = Number(sanctioned);
  const disbursedValue = Number(disbursed);
  const disbursalGiven = disbursed.trim() !== '' || disbursedOn !== '';
  const disbursalValid = !disbursalGiven || (disbursedValue > 0 && disbursedOn !== '' && disbursedOn >= sanctionedOn && disbursedOn <= today);
  const valid = lenderName.trim().length >= 2 && sanctionedValue > 0 && sanctionedOn !== '' && sanctionedOn <= today && disbursalValid && (note.trim() === '' || note.trim().length >= LEAD_NOTE_MIN_LENGTH);
  const save = useMutation({
    mutationFn: () =>
      reportOfflineConversion(leadId, {
        lenderName: lenderName.trim(),
        sanctionedAmountPaise: paiseFromRupees(sanctionedValue),
        sanctionedOn,
        ...(disbursalGiven ? { disbursedAmountPaise: paiseFromRupees(disbursedValue), disbursedOn } : {}),
        loanAccountRef: account.trim() || undefined,
        note: note.trim() || undefined,
      }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('conversionReported'));
      void queryClient.invalidateQueries({ queryKey: partnerLeadKeys.detail(leadId) });
      void queryClient.invalidateQueries({ queryKey: partnerKeys.dashboard() });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('conversionTitle')} description={t('conversionBody')} confirmLabel={t('report')} pending={save.isPending} confirmDisabled={!valid} onConfirm={() => save.mutate()}>
      <Field>
        <FieldLabel htmlFor={ids.lender}>{t('lenderName')}</FieldLabel>
        <Input id={ids.lender} value={lenderName} maxLength={120} onChange={(event) => setLenderName(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={ids.sanctioned}>{t('sanctionedRupees')}</FieldLabel>
          <Input id={ids.sanctioned} type="number" inputMode="numeric" min={1} value={sanctioned} onChange={(event) => setSanctioned(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.sanctionedOn}>{t('sanctionedOn')}</FieldLabel>
          <Input id={ids.sanctionedOn} type="date" max={today} value={sanctionedOn} onChange={(event) => setSanctionedOn(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.disbursed}>{t('disbursedRupees')}</FieldLabel>
          <Input id={ids.disbursed} type="number" inputMode="numeric" min={1} value={disbursed} onChange={(event) => setDisbursed(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.disbursedOn}>{t('disbursedOn')}</FieldLabel>
          <Input id={ids.disbursedOn} type="date" min={sanctionedOn || undefined} max={today} value={disbursedOn} onChange={(event) => setDisbursedOn(event.target.value)} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={ids.account}>{t('loanAccount')}</FieldLabel>
        <Input id={ids.account} value={account} maxLength={60} onChange={(event) => setAccount(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={ids.note}>{t('noteOptional')}</FieldLabel>
        <Textarea id={ids.note} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function ConvertDialog({ lead, open, onOpenChange }: { lead: PartnerLeadDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('partner.leadDetail');
  const errorToast = useErrorToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const segments = useQuery({ ...segmentsQuery(), enabled: open });
  const [segment, setSegment] = useState<string | null>(lead.lead.segmentKey);
  const [subSegment, setSubSegment] = useState<string | null>(lead.lead.subSegmentKey);
  const chosen = segments.data?.items.find((item) => item.key === segment);
  const needsSubSegment = Boolean(chosen?.subSegments.length);
  const valid = Boolean(segment) && (!needsSubSegment || Boolean(subSegment));
  const convert = useMutation({
    mutationFn: () => convertPartnerLead(lead.lead.id, { segment: segment ?? undefined, subSegment: subSegment ?? undefined, businessName: segment === BUSINESS_SEGMENT ? (lead.lead.businessName ?? undefined) : undefined, category: lead.lead.categoryKey ?? undefined }),
    meta: { handlesError: true },
    onSuccess: (application) => {
      toast.success(t('converted', { ref: application.ref }));
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      void queryClient.invalidateQueries({ queryKey: partnerLeadKeys.all });
      router.push(resumePath(PARTNER_PATHS, application));
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('convertTitle')} description={t('convertBody')} confirmLabel={t('convert')} pending={convert.isPending} confirmDisabled={!valid} onConfirm={() => convert.mutate()}>
      <ChipGroup label={t('segment')} showLabel>
        {segments.data?.items.map((item) => (
          <ChoiceChip
            key={item.key}
            selected={segment === item.key}
            label={item.label}
            onToggle={() => {
              setSegment(item.key);
              setSubSegment(null);
            }}
            className="min-h-9 text-[13px]"
          />
        ))}
      </ChipGroup>
      {needsSubSegment ? (
        <ChipGroup label={t('subSegment')} showLabel>
          {chosen?.subSegments.map((item) => (
            <ChoiceChip key={item.key} selected={subSegment === item.key} label={item.label} onToggle={() => setSubSegment(item.key)} className="min-h-9 text-[13px]" />
          ))}
        </ChipGroup>
      ) : null}
    </ConfirmDialog>
  );
}

function SubAssignDialog({ lead, open, onOpenChange }: { lead: PartnerLeadDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('partner.leadDetail');
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const team = useQuery({ ...partnerTeamQuery(), enabled: open });
  const [membershipId, setMembershipId] = useState<string | null>(lead.assignment.assigneeMembershipId);
  const members = (team.data?.members ?? []).filter((member) => member.status === MemberStatus.Active);
  const nameOf = (id: string | null) => {
    const member = members.find((item) => item.id === id);
    return member ? (member.displayName ?? t('memberFallback', { id: member.userId.slice(-6) })) : t('chooseMember');
  };
  const assign = useMutation({
    mutationFn: () => subAssignPartnerLead(lead.lead.id, membershipId ?? ''),
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(partnerLeadKeys.detail(lead.lead.id), next);
      toast.success(t('subAssigned'));
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('subAssignTitle')} confirmLabel={t('subAssign')} pending={assign.isPending} confirmDisabled={!membershipId || membershipId === lead.assignment.assigneeMembershipId} onConfirm={() => assign.mutate()}>
      <Field>
        <FieldLabel>{t('member')}</FieldLabel>
        <Select value={membershipId} onValueChange={(value) => setMembershipId(String(value))}>
          <SelectTrigger size="sm" className="h-11 w-full" aria-label={t('member')}>
            <SelectValue>{(current: string | null) => nameOf(current)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {nameOf(member.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </ConfirmDialog>
  );
}

function LeadView({ lead }: { lead: PartnerLeadDetail }) {
  const t = useTranslations('partner.leadDetail');
  const actionReasonLabel = { decline: useEnumLabel('declineReason'), return: useEnumLabel('returnReason'), lost: useEnumLabel('leadReason') };
  const urgencyLabel = useEnumLabel('urgency');
  const categoryLabel = useCategoryLabel();
  const tenureLabel = useTenureLabel();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const activities = useInfiniteQuery(partnerLeadActivitiesQuery(lead.lead.id));
  const [reasoned, setReasoned] = useState<Reasoned | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealed, setRevealed] = useState<LeadContact[] | null>(null);
  const [dialog, setDialog] = useState<'edit' | 'conversion' | 'convert' | 'followUp' | 'subAssign' | null>(null);
  const can = (action: string) => lead.availableActions.includes(action);
  const refresh = () => queryClient.invalidateQueries({ queryKey: partnerLeadKeys.all });
  const accept = useMutation({
    mutationFn: () => acceptPartnerLead(lead.lead.id),
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(partnerLeadKeys.detail(lead.lead.id), next);
      toast.success(t('accepted'));
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const decide = useMutation({
    mutationFn: async ({ kind, reason, note }: { kind: Reasoned; reason: string; note: string }): Promise<unknown> => {
      const body = { reason, note: note || undefined };
      if (kind === 'decline') return declinePartnerLead(lead.lead.id, body);
      if (kind === 'return') return returnPartnerLead(lead.lead.id, body);
      return losePartnerLead(lead.lead.id, body);
    },
    meta: { handlesError: true },
    onSuccess: (_, { kind }) => {
      toast.success(t(`done.${kind}`));
      setReasoned(null);
      void refresh();
      void queryClient.invalidateQueries({ queryKey: partnerKeys.dashboard() });
      if (kind !== 'lost') router.push(AppPath.PartnerLeads);
    },
    onError: (failure) => errorToast(failure),
  });
  const reveal = useMutation({
    mutationFn: (reason: string) => revealPartnerContact(lead.lead.id, reason),
    meta: { handlesError: true },
    onSuccess: (result) => {
      setRevealed(result.contacts);
      setRevealOpen(false);
      void queryClient.invalidateQueries({ queryKey: partnerLeadKeys.detail(lead.lead.id) });
    },
    onError: (failure) => errorToast(failure),
  });
  const workable = can(PartnerLeadAction.LogActivity);
  const offered = can(PartnerLeadAction.Accept);
  const { lead: info, assignment } = lead;
  const options = reasoned ? REASONS[reasoned].map((value) => ({ value, label: actionReasonLabel[reasoned](value) })) : undefined;
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.PartnerLeads} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={info.ref}
        title={info.name ?? info.ref}
        description={info.businessName ?? undefined}
        badge={
          <span className="flex gap-1.5">
            <StatusBadge status={assignment.status} tone={toneOf(REVIEW_STATUS_TONE, assignment.status)} />
            <StatusBadge status={info.status} tone={toneOf(LEAD_STATUS_TONE, info.status)} />
          </span>
        }
        actions={
          <>
            {offered ? (
              <>
                <Button size="sm" onClick={() => accept.mutate()} disabled={accept.isPending}>
                  <Icon name="check" size={16} />
                  {t('accept')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setReasoned('decline')}>
                  {t('decline')}
                </Button>
              </>
            ) : null}
            {workable ? (
              <>
                <Button size="sm" onClick={() => setDialog('convert')}>
                  <Icon name="folder" size={16} />
                  {t('convert')}
                </Button>
                {can(PartnerLeadAction.OfflineConversion) ? (
                  <Button size="sm" variant="outline" onClick={() => setDialog('conversion')}>
                    {t('reportConversion')}
                  </Button>
                ) : null}
                {can(PartnerLeadAction.SubAssign) ? (
                  <Button size="sm" variant="outline" onClick={() => setDialog('subAssign')}>
                    {t('subAssign')}
                  </Button>
                ) : null}
                {can(PartnerLeadAction.Return) ? (
                  <Button size="sm" variant="outline" onClick={() => setReasoned('return')}>
                    {t('return')}
                  </Button>
                ) : null}
                {can(PartnerLeadAction.Lost) ? (
                  <Button size="sm" variant="destructive" onClick={() => setReasoned('lost')}>
                    {t('lost')}
                  </Button>
                ) : null}
              </>
            ) : null}
          </>
        }
      />
      {offered && assignment.respondBy ? (
        <p className="flex items-center gap-2 rounded-xl bg-gold-soft px-4 py-3 text-sm text-navy">
          <Icon name="alarm" size={18} className="text-gold-ink" />
          {t('offerDeadline', { when: formatDateTime(assignment.respondBy, locale) })}
        </p>
      ) : null}
      {workable && assignment.firstContactBy ? (
        <p className="flex items-center gap-2 rounded-xl bg-subtle px-4 py-3 text-sm text-navy">
          <Icon name="phone" size={18} className="text-gold-ink" />
          {t('firstContactBy', { when: formatDateTime(assignment.firstContactBy, locale) })}
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <Section
          title={t('summary')}
          action={
            can(PartnerLeadAction.Edit) ? (
              <Button variant="ghost" size="xs" onClick={() => setDialog('edit')}>
                <Icon name="edit" size={14} />
                {t('edit')}
              </Button>
            ) : null
          }
        >
          <KeyValues
            columns={3}
            items={[
              { label: t('category'), value: categoryLabel(info.categoryKey) || '—' },
              { label: t('amount'), value: info.amount.minPaise ? formatPaise(info.amount.minPaise, locale) : (info.amount.text ?? '—') },
              { label: t('tenure'), value: info.tenureMonths ? tenureLabel(info.tenureMonths) : '—' },
              { label: t('place'), value: [info.location.city?.name, info.location.state?.name].filter(Boolean).join(', ') || '—' },
              { label: t('urgency'), value: urgencyLabel(info.urgency) },
              { label: t('contactTime'), value: info.preferredContactTime ?? '—' },
              { label: t('offered'), value: formatRelative(assignment.offeredAt, locale) },
              { label: t('acceptedAt'), value: formatDateTime(assignment.acceptedAt, locale) },
              { label: t('purposeNote'), value: info.purposeNote ?? '—' },
            ]}
          />
        </Section>
        <Section
          title={t('contacts')}
          delay={0.04}
          action={
            can(PartnerLeadAction.RevealContact) && !revealed ? (
              <Button variant="outline" size="xs" onClick={() => setRevealOpen(true)}>
                <Icon name="visibility" size={14} />
                {t('reveal')}
              </Button>
            ) : null
          }
        >
          <LeadContacts contacts={revealed ?? lead.contacts} />
          <p className="text-xs text-muted-foreground">{revealed ? t('revealLogged') : offered ? t('acceptToReveal') : t('revealHint')}</p>
        </Section>
        {workable ? (
          <Section title={t('activities')} delay={0.06} action={can(PartnerLeadAction.FollowUp) ? <Button variant="ghost" size="xs" onClick={() => setDialog('followUp')}><Icon name="alarm" size={14} />{t('followUp')}</Button> : null}>
            <ActivityForm log={(input) => logPartnerActivity(lead.lead.id, input)} onLogged={() => void queryClient.invalidateQueries({ queryKey: partnerLeadKeys.detail(lead.lead.id) })} />
            <ActivityList result={activities} />
          </Section>
        ) : null}
        <Section title={t('conversions')} delay={0.08}>
          {lead.conversions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noConversions')}</p>
          ) : (
            <ul className="flex flex-col">
              {lead.conversions.map((conversion) => (
                <li key={conversion.id} className="flex items-start justify-between gap-2 border-t border-subtle py-2.5 first:border-t-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{conversion.lenderName}</span>
                    <span className="text-xs text-muted-foreground tabular">{t('sanctionedLine', { amount: formatPaise(conversion.sanctionedAmountPaise, locale), date: conversion.sanctionedOn ?? '—' })}</span>
                    {conversion.decisionNote ? <span className="text-xs text-muted-foreground">{conversion.decisionNote}</span> : null}
                  </span>
                  <StatusBadge status={conversion.status} tone={toneOf(REVIEW_STATUS_TONE, conversion.status)} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      <ReasonDialog
        key={reasoned ?? 'none'}
        open={reasoned !== null}
        onOpenChange={(open) => (open ? null : setReasoned(null))}
        title={reasoned ? t(`titles.${reasoned}`) : ''}
        description={reasoned ? t(`bodies.${reasoned}`) : undefined}
        label={t('note')}
        confirmLabel={reasoned ? t(reasoned) : ''}
        destructive={reasoned === 'lost'}
        pending={decide.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        noteOptional
        noteRequiredFor={[OTHER_REASON]}
        options={options}
        optionsLabel={t('reason')}
        onConfirm={(note, reason) => (reasoned && reason ? decide.mutate({ kind: reasoned, reason, note }) : null)}
      />
      <ReasonDialog open={revealOpen} onOpenChange={setRevealOpen} title={t('revealTitle')} description={t('revealBody')} label={t('revealReason')} confirmLabel={t('reveal')} pending={reveal.isPending} minLength={LEAD_NOTE_MIN_LENGTH} maxLength={LEAD_NOTE_MAX_LENGTH} onConfirm={(reason) => reveal.mutate(reason)} />
      {dialog === 'edit' ? <EditDialog lead={lead} open onOpenChange={(open) => (open ? null : setDialog(null))} /> : null}
      {dialog === 'conversion' ? <ConversionDialog leadId={lead.lead.id} open onOpenChange={(open) => (open ? null : setDialog(null))} /> : null}
      {dialog === 'convert' ? <ConvertDialog lead={lead} open onOpenChange={(open) => (open ? null : setDialog(null))} /> : null}
      {dialog === 'subAssign' ? <SubAssignDialog lead={lead} open onOpenChange={(open) => (open ? null : setDialog(null))} /> : null}
      {dialog === 'followUp' ? <FollowUpDialog open onOpenChange={(open) => (open ? null : setDialog(null))} schedule={(input) => schedulePartnerFollowUp(lead.lead.id, input)} onScheduled={() => void refresh()} /> : null}
    </div>
  );
}

export function PartnerLeadDetail() {
  const t = useTranslations('partner.leadDetail');
  const { id } = useParams<{ id: string }>();
  const lead = useQuery(partnerLeadQuery(id));
  if (lead.isPending) return <ScreenSkeleton />;
  if (!lead.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <LeadView lead={lead.data} />;
}
