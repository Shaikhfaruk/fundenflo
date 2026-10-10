'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { KeyValues, Section } from '@/components/data/detail-section';
import { pagedRows } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
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
import { Link } from '@/i18n/navigation';
import {
  assignLead,
  type LeadAction,
  leadActivitiesQuery,
  logLeadActivity,
  opsLeadKeys,
  opsLeadQuery,
  revealLeadContact,
  revokeAssignment,
  routeLead,
  runLeadAction,
  scheduleLeadFollowUp,
  sendLeadConsentRequest,
  updateOpsLead,
  verifiedPartnersQuery,
} from '@/lib/api/leads';
import type { OpsLeadDetail } from '@/lib/api/types/lead.types';
import type { LeadContact } from '@/lib/api/types/ops.types';
import { ACTIVITY_BODY_MAX_LENGTH, ACTIVITY_OUTCOMES, ACTIVITY_TYPES, ActivityType, FOLLOW_UP_MAX_DAYS_AHEAD, LEAD_LOST_REASONS, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH, LEAD_UNQUALIFIED_REASONS, LEAD_URGENCIES } from '@/lib/constants/ops.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { LEAD_CONSENT_TONE, LEAD_STATUS_TONE, REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { formatPhone } from '@/lib/format/phone';

const ACTIONS_BY_STATUS: Record<string, LeadAction[]> = {
  new: ['qualify', 'hold', 'disqualify', 'lose'],
  qualified: ['hold', 'recycle', 'disqualify', 'lose'],
  in_progress: ['hold', 'recycle', 'lose'],
  on_hold: ['reopen', 'recycle', 'disqualify', 'lose'],
  converted: ['lose'],
};

const DAY_MS = 24 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

const localDateTime = (time: number) => new Date(time - new Date(time).getTimezoneOffset() * MINUTE_MS).toISOString().slice(0, 16);

const ACTIVE_ASSIGNMENTS: readonly string[] = ['offered', 'accepted', 'working'];

const ROUTABLE: readonly string[] = ['new', 'qualified'];

const REASON_OPTIONS: Partial<Record<LeadAction, readonly string[]>> = { disqualify: LEAD_UNQUALIFIED_REASONS, lose: LEAD_LOST_REASONS };

function ActivityForm({ leadId }: { leadId: string }) {
  const t = useTranslations('ops.leadDetail');
  const typeLabel = useEnumLabel('activityType');
  const outcomeLabel = useEnumLabel('activityOutcome');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const bodyId = useId();
  const [type, setType] = useState<string>(ActivityType.Call);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const log = useMutation({
    mutationFn: () => logLeadActivity(leadId, { type, outcome: type === ActivityType.Call && outcome ? outcome : undefined, body: body.trim() || undefined }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('activityLogged'));
      setBody('');
      setOutcome(null);
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.detail(leadId) });
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-subtle/60 p-3">
      <ChipGroup label={t('activityType')}>
        {ACTIVITY_TYPES.map((value) => (
          <ChoiceChip key={value} selected={type === value} label={typeLabel(value)} onToggle={() => setType(value)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      {type === ActivityType.Call ? (
        <ChipGroup label={t('outcome')}>
          {ACTIVITY_OUTCOMES.map((value) => (
            <ChoiceChip key={value} selected={outcome === value} label={outcomeLabel(value)} onToggle={() => setOutcome(value)} className="min-h-8 text-xs" />
          ))}
        </ChipGroup>
      ) : null}
      <Field>
        <FieldLabel htmlFor={bodyId}>{t('activityNote')}</FieldLabel>
        <Textarea id={bodyId} rows={2} value={body} maxLength={ACTIVITY_BODY_MAX_LENGTH} onChange={(event) => setBody(event.target.value)} />
      </Field>
      <Button size="sm" className="self-start" onClick={() => log.mutate()} disabled={log.isPending || (type === ActivityType.Note && body.trim().length === 0)}>
        {t('logActivity')}
      </Button>
    </div>
  );
}

function FollowUpDialog({ leadId, open, onOpenChange }: { leadId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.leadDetail');
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const dueId = useId();
  const noteId = useId();
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [now] = useState(() => Date.now());
  const dueAt = due ? new Date(due).getTime() : Number.NaN;
  const dueValid = Number.isFinite(dueAt) && dueAt > now && dueAt <= now + FOLLOW_UP_MAX_DAYS_AHEAD * DAY_MS;
  const schedule = useMutation({
    mutationFn: () => scheduleLeadFollowUp(leadId, { dueAt: new Date(due).toISOString(), note: note.trim() }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('followUpScheduled'));
      setDue('');
      setNote('');
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('followUpTitle')} confirmLabel={t('schedule')} pending={schedule.isPending} confirmDisabled={!dueValid || note.trim().length < LEAD_NOTE_MIN_LENGTH} onConfirm={() => schedule.mutate()}>
      <Field>
        <FieldLabel htmlFor={dueId}>{t('dueAt')}</FieldLabel>
        <Input id={dueId} type="datetime-local" value={due} min={localDateTime(now)} max={localDateTime(now + FOLLOW_UP_MAX_DAYS_AHEAD * DAY_MS)} onChange={(event) => setDue(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={noteId}>{t('followUpNote')}</FieldLabel>
        <Textarea id={noteId} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function AssignDialog({ leadId, open, onOpenChange }: { leadId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.leadDetail');
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const noteId = useId();
  const partners = useQuery({ ...verifiedPartnersQuery(), enabled: open });
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const options = (partners.data?.items ?? []).filter((partner) => partner.organizationStatus === 'active');
  const assign = useMutation({
    mutationFn: () => assignLead(leadId, organizationId ?? '', note.trim() || undefined),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('assigned'));
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('assignTitle')} description={t('assignBody')} confirmLabel={t('assign')} pending={assign.isPending} confirmDisabled={!organizationId || (note.trim().length > 0 && note.trim().length < LEAD_NOTE_MIN_LENGTH)} onConfirm={() => assign.mutate()}>
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
        {options.length === 0 && !partners.isPending ? <p className="text-xs text-muted-foreground">{t('noPartners')}</p> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={noteId}>{t('noteOptional')}</FieldLabel>
        <Textarea id={noteId} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function EditDialog({ lead, open, onOpenChange }: { lead: OpsLeadDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.leadDetail');
  const urgencyLabel = useEnumLabel('urgency');
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const campaignId = useId();
  const timeId = useId();
  const [campaign, setCampaign] = useState(lead.campaign ?? '');
  const [urgency, setUrgency] = useState<string | null>(lead.urgency);
  const [contactTime, setContactTime] = useState(lead.preferredContactTime ?? '');
  const save = useMutation({
    mutationFn: () => updateOpsLead(lead.id, { campaign: campaign.trim() || null, urgency, preferredContactTime: contactTime.trim() || null }, lead.version),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('saved'));
      void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('editTitle')} confirmLabel={t('save')} pending={save.isPending} onConfirm={() => save.mutate()}>
      <Field>
        <FieldLabel htmlFor={campaignId}>{t('campaign')}</FieldLabel>
        <Input id={campaignId} value={campaign} maxLength={100} onChange={(event) => setCampaign(event.target.value)} />
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

function LeadView({ lead }: { lead: OpsLeadDetail }) {
  const t = useTranslations('ops.leadDetail');
  const tStatus = useTranslations('status');
  const tSources = useTranslations('sources');
  const actionLabel = useEnumLabel('leadAction');
  const reasonLabel = useEnumLabel('leadReason');
  const eventLabel = useEnumLabel('leadEvent');
  const flagLabel = useEnumLabel('leadFlag');
  const typeLabel = useEnumLabel('activityType');
  const outcomeLabel = useEnumLabel('activityOutcome');
  const urgencyLabel = useEnumLabel('urgency');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const activities = useInfiniteQuery(leadActivitiesQuery(lead.id));
  const [action, setAction] = useState<LeadAction | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealed, setRevealed] = useState<LeadContact[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: opsLeadKeys.all });
  const run = useMutation({
    mutationFn: ({ kind, note, reason }: { kind: LeadAction; note: string; reason: string | null }) => runLeadAction(lead.id, kind, { note: note || undefined, ...(reason ? { reason } : {}) }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('updated'));
      setAction(null);
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const reveal = useMutation({
    mutationFn: (reason: string) => revealLeadContact(lead.id, reason),
    meta: { handlesError: true },
    onSuccess: (result) => {
      setRevealed(result.contacts);
      setRevealOpen(false);
    },
    onError: (failure) => errorToast(failure),
  });
  const consent = useMutation({
    mutationFn: () => sendLeadConsentRequest(lead.id),
    meta: { handlesError: true },
    onSuccess: (result) => {
      toast.success(t('consentSent', { recipient: result.recipient }));
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const route = useMutation({
    mutationFn: () => routeLead(lead.id),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('routed'));
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const revoke = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => revokeAssignment(id, reason),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('revoked'));
      setRevoking(null);
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const actions = ACTIONS_BY_STATUS[lead.status] ?? [];
  const contacts = revealed ?? lead.contacts;
  const options = action ? REASON_OPTIONS[action] : undefined;
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.OpsHome} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={lead.ref}
        title={lead.party?.displayName ?? lead.ref}
        description={lead.business?.displayName ?? undefined}
        badge={
          <span className="flex gap-1.5">
            <StatusBadge status={lead.status} tone={toneOf(LEAD_STATUS_TONE, lead.status)} />
            <StatusBadge status={lead.consentStatus} tone={toneOf(LEAD_CONSENT_TONE, lead.consentStatus)} />
          </span>
        }
        actions={
          <>
            {actions.map((item) => (
              <Button key={item} size="sm" variant={item === 'qualify' || item === 'reopen' ? 'default' : item === 'disqualify' || item === 'lose' ? 'destructive' : 'outline'} onClick={() => setAction(item)}>
                {actionLabel(item)}
              </Button>
            ))}
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('summary')} action={<Button variant="ghost" size="xs" onClick={() => setEditOpen(true)}><Icon name="edit" size={14} />{t('edit')}</Button>}>
            <KeyValues
              columns={3}
              items={[
                { label: t('source'), value: tSources.has(lead.source.kind) ? tSources(lead.source.kind) : lead.source.key },
                { label: t('campaign'), value: lead.campaign ?? '—' },
                { label: t('category'), value: categoryLabel(lead.categoryKey) || '—' },
                { label: t('amount'), value: lead.amount.text ?? '—' },
                { label: t('city'), value: lead.location.city?.name ?? lead.location.state?.name ?? lead.location.text ?? '—' },
                { label: t('urgency'), value: urgencyLabel(lead.urgency) },
                { label: t('language'), value: lead.preferredLanguage ?? '—' },
                { label: t('contactTime'), value: lead.preferredContactTime ?? '—' },
                { label: t('quality'), value: lead.qualityScore ?? '—' },
                { label: t('created'), value: formatDateTime(lead.createdAt, locale) },
                { label: t('consentEvidence'), value: lead.consentEvidence ?? '—' },
                { label: t('flags'), value: lead.flags.length > 0 ? lead.flags.map(flagLabel).join(', ') : '—' },
              ]}
            />
            {lead.convertedApplicationId ? (
              <Link href={RoutePath.opsCase(lead.convertedApplicationId)} className="flex items-center gap-1 text-sm font-semibold text-gold-deep hover:underline">
                {t('openCase')}
                <Icon name="arrow-forward" size={14} />
              </Link>
            ) : null}
          </Section>
          <Section title={t('contacts')} delay={0.04} action={revealed ? null : <Button variant="outline" size="xs" onClick={() => setRevealOpen(true)}><Icon name="visibility" size={14} />{t('reveal')}</Button>}>
            <ul className="flex flex-col gap-2">
              {contacts.map((contact) => (
                <li key={`${contact.type}-${contact.masked}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <Icon name={contact.type === 'email' ? 'mail' : 'phone'} size={16} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground tabular select-all">{contact.value ? (contact.type === 'mobile' ? formatPhone(contact.value) : contact.value) : contact.masked}</span>
                  {contact.primary ? <span className="rounded-xs bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{t('primary')}</span> : null}
                  {contact.doNotContact ? <span className="rounded-xs bg-error-soft px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{t('doNotContact')}</span> : null}
                  {contact.invalid ? <span className="rounded-xs bg-error-soft px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{t('invalid')}</span> : null}
                </li>
              ))}
            </ul>
            {revealed ? <p className="text-xs text-muted-foreground">{t('revealLogged')}</p> : null}
          </Section>
          <Section title={t('activities')} delay={0.08} action={<Button variant="ghost" size="xs" onClick={() => setFollowUpOpen(true)}><Icon name="alarm" size={14} />{t('followUp')}</Button>}>
            <ActivityForm leadId={lead.id} />
            <ul className="flex flex-col">
              {pagedRows(activities).map((activity) => (
                <li key={activity.id} className="flex flex-col border-t border-subtle py-2 first:border-t-0">
                  <span className="text-sm font-semibold text-foreground">
                    {typeLabel(activity.type)}
                    {activity.outcome ? ` · ${outcomeLabel(activity.outcome)}` : ''}
                  </span>
                  {activity.body ? <span className="text-[13px] text-muted-foreground">{activity.body}</span> : null}
                  <span className="text-xs text-muted-foreground">{formatRelative(activity.occurredAt, locale)}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title={t('timeline')} delay={0.12}>
            <ol className="flex flex-col">
              {lead.events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 border-t border-subtle py-2 first:border-t-0">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-navy" aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-foreground">
                      {eventLabel(event.type)}
                      {event.toStatus ? ` · ${tStatus.has(event.toStatus) ? tStatus(event.toStatus) : event.toStatus}` : ''}
                    </span>
                    {event.note || event.reason ? <span className="text-[13px] text-muted-foreground">{event.note ?? event.reason}</span> : null}
                    <span className="text-xs text-muted-foreground">{formatRelative(event.createdAt, locale)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('consent')} delay={0.04}>
            <p className="text-sm text-muted-foreground">{t(`consentState.${lead.consentStatus}`)}</p>
            {lead.consentStatus !== 'ok' ? (
              <Button variant="outline" size="sm" className="self-start" onClick={() => consent.mutate()} disabled={consent.isPending}>
                <Icon name="sms" size={16} />
                {t('sendConsentLink')}
              </Button>
            ) : null}
          </Section>
          <Section title={t('assignments')} delay={0.08}>
            {lead.assignments.length === 0 ? <p className="text-sm text-muted-foreground">{t('noAssignments')}</p> : null}
            <ul className="flex flex-col">
              {lead.assignments.map((assignment) => (
                <li key={assignment.id} className="flex items-center gap-2 border-t border-subtle py-2.5 first:border-t-0">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{assignment.organization?.name ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">{t('offeredOn', { when: formatRelative(assignment.offeredAt, locale) })}</span>
                  </span>
                  <StatusBadge status={assignment.status} tone={toneOf(REVIEW_STATUS_TONE, assignment.status)} />
                  {ACTIVE_ASSIGNMENTS.includes(assignment.status) ? (
                    <Button variant="ghost" size="xs" className="text-destructive" onClick={() => setRevoking(assignment.id)}>
                      {t('revoke')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {ROUTABLE.includes(lead.status) ? (
                <Button size="sm" onClick={() => route.mutate()} disabled={route.isPending}>
                  <Icon name="sync-alt" size={16} />
                  {t('route')}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
                {t('assignManually')}
              </Button>
            </div>
          </Section>
        </div>
      </div>
      <ReasonDialog
        key={action ?? 'none'}
        open={action !== null}
        onOpenChange={(open) => (open ? null : setAction(null))}
        title={action ? t('actionTitle', { action: actionLabel(action) }) : ''}
        label={t('note')}
        confirmLabel={action ? actionLabel(action) : ''}
        destructive={action === 'disqualify' || action === 'lose'}
        pending={run.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        noteOptional
        options={options?.map((value) => ({ value, label: reasonLabel(value) }))}
        optionsLabel={options ? t('reason') : undefined}
        onConfirm={(note, reason) => (action ? run.mutate({ kind: action, note, reason }) : null)}
      />
      <ReasonDialog open={revealOpen} onOpenChange={setRevealOpen} title={t('revealTitle')} description={t('revealBody')} label={t('revealReason')} confirmLabel={t('reveal')} pending={reveal.isPending} minLength={LEAD_NOTE_MIN_LENGTH} maxLength={LEAD_NOTE_MAX_LENGTH} onConfirm={(reason) => reveal.mutate(reason)} />
      <ReasonDialog open={revoking !== null} onOpenChange={(open) => (open ? null : setRevoking(null))} title={t('revokeTitle')} label={t('revokeReason')} confirmLabel={t('revoke')} destructive pending={revoke.isPending} minLength={LEAD_NOTE_MIN_LENGTH} maxLength={LEAD_NOTE_MAX_LENGTH} onConfirm={(reason) => (revoking ? revoke.mutate({ id: revoking, reason }) : null)} />
      <AssignDialog leadId={lead.id} open={assignOpen} onOpenChange={setAssignOpen} />
      {followUpOpen ? <FollowUpDialog leadId={lead.id} open={followUpOpen} onOpenChange={setFollowUpOpen} /> : null}
      {editOpen ? <EditDialog lead={lead} open={editOpen} onOpenChange={setEditOpen} /> : null}
    </div>
  );
}

export function OpsLeadDetail() {
  const t = useTranslations('ops.leadDetail');
  const { id } = useParams<{ id: string }>();
  const lead = useQuery(opsLeadQuery(id));
  if (lead.isPending) return <ScreenSkeleton />;
  if (!lead.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <LeadView lead={lead.data} />;
}
