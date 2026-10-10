'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { Section } from '@/components/data/detail-section';
import { pagedRows } from '@/components/data/paged-list';
import { FactValueInput } from '@/components/ops/fact-value-input';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { segmentsQuery } from '@/lib/api/catalog';
import { attributesQuery } from '@/lib/api/ops-cases';
import { mergeParties, opsPartyKeys, partyAnswersQuery, partyConsentHistoryQuery, partyConsentsQuery, partyFactHistoryQuery, partyFactsQuery, recordPartyAnswers, recordPartyConsents, recordPartyFacts } from '@/lib/api/ops-parties';
import type { AttributeDefinition } from '@/lib/api/types/admin.types';
import { ANSWER_STAGE, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH, OPS_CONSENT_CHANNELS, OPS_CONSENT_EVIDENCE_MIN_LENGTH, PARTY_REASON_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { formatRelative } from '@/lib/format/date';
import { formatFactValue, parseFactInput, textOf } from '@/lib/format/fact';
import { pickText } from '@/lib/format/localised';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUESTION_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function RecordFactDialog({ partyId, attributes, open, onOpenChange }: { partyId: string; attributes: AttributeDefinition[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.party');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const valueId = useId();
  const noteId = useId();
  const [key, setKey] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const attribute = attributes.find((item) => item.key === key);
  const parsed = parseFactInput(value, attribute);
  const record = useMutation({
    mutationFn: () => recordPartyFacts(partyId, { facts: [{ attributeKey: key ?? '', value: parsed.ok ? parsed.value : null }], note: note.trim() }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('factRecorded'));
      setValue('');
      setNote('');
      void queryClient.invalidateQueries({ queryKey: opsPartyKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('recordFact')} confirmLabel={t('save')} pending={record.isPending} confirmDisabled={!key || !parsed.ok || note.trim().length < LEAD_NOTE_MIN_LENGTH} onConfirm={() => record.mutate()}>
      <Field>
        <FieldLabel>{t('attribute')}</FieldLabel>
        <Select value={key} onValueChange={(next) => { setKey(String(next)); setValue(''); }}>
          <SelectTrigger size="sm" className="h-11 w-full" aria-label={t('attribute')}>
            <SelectValue>{(current: string | null) => (current ? pickText(attributes.find((item) => item.key === current)?.label, locale) || current : t('chooseAttribute'))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {attributes.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                {pickText(item.label, locale) || item.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={valueId}>{t('value')}</FieldLabel>
        <FactValueInput id={valueId} attribute={attribute} value={value} onChange={setValue} label={t('value')} disabled={!key} />
      </Field>
      <Field>
        <FieldLabel htmlFor={noteId}>{t('evidence')}</FieldLabel>
        <Textarea id={noteId} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function RecordConsentDialog({ partyId, purposes, open, onOpenChange }: { partyId: string; purposes: Array<{ purpose: string; label: string }>; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.party');
  const channelLabel = useEnumLabel('consentChannel');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const evidenceId = useId();
  const [purpose, setPurpose] = useState<string | null>(null);
  const [granted, setGranted] = useState(true);
  const [channel, setChannel] = useState<string>(OPS_CONSENT_CHANNELS[0]);
  const [evidence, setEvidence] = useState('');
  const record = useMutation({
    mutationFn: () => recordPartyConsents(partyId, { channel, evidence: evidence.trim(), items: [{ purpose: purpose ?? '', granted }] }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('consentRecorded'));
      setEvidence('');
      void queryClient.invalidateQueries({ queryKey: opsPartyKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('recordConsent')} confirmLabel={t('save')} pending={record.isPending} confirmDisabled={!purpose || evidence.trim().length < OPS_CONSENT_EVIDENCE_MIN_LENGTH} onConfirm={() => record.mutate()}>
      <Field>
        <FieldLabel>{t('purpose')}</FieldLabel>
        <Select value={purpose} onValueChange={(next) => setPurpose(String(next))}>
          <SelectTrigger size="sm" className="h-11 w-full" aria-label={t('purpose')}>
            <SelectValue>{(current: string | null) => purposes.find((item) => item.purpose === current)?.label ?? t('choosePurpose')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {purposes.map((item) => (
              <SelectItem key={item.purpose} value={item.purpose}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <label className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
        {granted ? t('granted') : t('refused')}
        <Switch checked={granted} onCheckedChange={setGranted} />
      </label>
      <Field>
        <FieldLabel>{t('channel')}</FieldLabel>
        <Select value={channel} onValueChange={(next) => setChannel(String(next))}>
          <SelectTrigger size="sm" className="h-11 w-full" aria-label={t('channel')}>
            <SelectValue>{(current: string) => channelLabel(current)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {OPS_CONSENT_CHANNELS.map((item) => (
              <SelectItem key={item} value={item}>
                {channelLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={evidenceId}>{t('evidence')}</FieldLabel>
        <Textarea id={evidenceId} rows={2} value={evidence} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setEvidence(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function RecordAnswerDialog({ partyId, open, onOpenChange }: { partyId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.party');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const keyId = useId();
  const valueId = useId();
  const segments = useQuery({ ...segmentsQuery(), enabled: open });
  const [segment, setSegment] = useState<string | null>(null);
  const [questionKey, setQuestionKey] = useState('');
  const [value, setValue] = useState('');
  const record = useMutation({
    mutationFn: () => recordPartyAnswers(partyId, { stage: ANSWER_STAGE, segment: segment ?? undefined, answers: [{ questionKey: questionKey.trim(), value: value.trim() }] }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('answerRecorded'));
      setQuestionKey('');
      setValue('');
      void queryClient.invalidateQueries({ queryKey: opsPartyKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('recordAnswer')} description={t('recordAnswerBody')} confirmLabel={t('save')} pending={record.isPending} confirmDisabled={!segment || !QUESTION_KEY_PATTERN.test(questionKey.trim()) || value.trim().length === 0} onConfirm={() => record.mutate()}>
      <ChipGroup label={t('segment')} showLabel>
        {(segments.data?.items ?? []).map((item) => (
          <ChoiceChip key={item.key} selected={segment === item.key} label={item.label} onToggle={() => setSegment(item.key)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      <Field>
        <FieldLabel htmlFor={keyId}>{t('questionKey')}</FieldLabel>
        <Input id={keyId} value={questionKey} onChange={(event) => setQuestionKey(event.target.value)} className="font-mono" />
      </Field>
      <Field>
        <FieldLabel htmlFor={valueId}>{t('answer')}</FieldLabel>
        <Input id={valueId} value={value} onChange={(event) => setValue(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function MergeDialog({ partyId, open, onOpenChange }: { partyId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.party');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const otherId = useId();
  const reasonId = useId();
  const [other, setOther] = useState('');
  const [reason, setReason] = useState('');
  const merge = useMutation({
    mutationFn: () => mergeParties({ survivorPartyId: partyId, mergedPartyId: other.trim(), reason: reason.trim() }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('merged'));
      void queryClient.invalidateQueries({ queryKey: opsPartyKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('mergeTitle')} description={t('mergeBody')} confirmLabel={t('merge')} destructive pending={merge.isPending} confirmDisabled={!UUID_PATTERN.test(other.trim()) || other.trim() === partyId || reason.trim().length < PARTY_REASON_MIN_LENGTH} onConfirm={() => merge.mutate()}>
      <Field>
        <FieldLabel htmlFor={otherId}>{t('duplicateId')}</FieldLabel>
        <Input id={otherId} value={other} onChange={(event) => setOther(event.target.value)} className="font-mono text-xs" />
      </Field>
      <Field>
        <FieldLabel htmlFor={reasonId}>{t('reason')}</FieldLabel>
        <Textarea id={reasonId} rows={2} value={reason} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

export function OpsParty() {
  const t = useTranslations('ops.party');
  const tCommon = useTranslations('common');
  const provenanceLabel = useEnumLabel('provenance');
  const channelLabel = useEnumLabel('consentChannel');
  const locale = useLocale();
  const { partyId } = useParams<{ partyId: string }>();
  const facts = useQuery(partyFactsQuery(partyId));
  const history = useInfiniteQuery(partyFactHistoryQuery(partyId));
  const consents = useQuery(partyConsentsQuery(partyId));
  const consentHistory = useInfiniteQuery(partyConsentHistoryQuery(partyId));
  const answers = useInfiniteQuery(partyAnswersQuery(partyId));
  const attributes = useQuery(attributesQuery());
  const [factOpen, setFactOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const attributeList = (attributes.data?.items ?? []).filter((item) => item.status === 'active');
  const attributeOf = (key: string) => attributeList.find((item) => item.key === key);
  const yesNo = { yes: tCommon('yes'), no: tCommon('no') };
  const factRow = (fact: { factId: string; attributeKey: string; value: unknown; provenance: string; observedAt: string }) => (
    <li key={fact.factId} className="flex flex-wrap items-center gap-2 border-t border-subtle py-2 first:border-t-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{pickText(attributeOf(fact.attributeKey)?.label, locale) || fact.attributeKey}</span>
        <span className="text-xs text-muted-foreground">{`${provenanceLabel(fact.provenance)} · ${formatRelative(fact.observedAt, locale)}`}</span>
      </span>
      <span className="text-sm font-semibold text-navy tabular">{formatFactValue(fact.value, attributeOf(fact.attributeKey), locale, yesNo)}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={partyId}
        actions={
          <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}>
            {t('mergeDuplicate')}
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <Section title={t('facts')} action={<Button size="xs" onClick={() => setFactOpen(true)}>{t('recordFact')}</Button>}>
          {facts.isPending ? <Skeleton className="h-24 w-full" /> : (facts.data?.items ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t('noFacts')}</p> : <ul className="flex flex-col">{(facts.data?.items ?? []).map(factRow)}</ul>}
        </Section>
        <Section title={t('consents')} delay={0.04} action={<Button size="xs" onClick={() => setConsentOpen(true)}>{t('recordConsent')}</Button>}>
          <ul className="flex flex-col gap-1.5">
            {(consents.data?.items ?? []).map((consent) => (
              <li key={consent.purpose} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">{consent.label}</span>
                <span className={consent.granted ? 'text-xs font-semibold text-success' : 'text-xs text-muted-foreground'}>{consent.granted ? t('granted') : consent.lastRecordId ? t('refused') : t('notAsked')}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t('factHistory')} delay={0.08}>
          <ul className="flex flex-col">{pagedRows(history).map(factRow)}</ul>
          {history.hasNextPage ? <Button variant="outline" size="xs" className="self-start" onClick={() => void history.fetchNextPage()}>{tCommon('loadMore')}</Button> : null}
        </Section>
        <Section title={t('consentHistory')} delay={0.12}>
          <ul className="flex flex-col">
            {pagedRows(consentHistory).map((record) => (
              <li key={record.id} className="flex flex-col border-t border-subtle py-2 first:border-t-0">
                <span className="text-sm text-foreground">{`${record.purpose} · ${record.granted ? t('granted') : t('refused')}`}</span>
                <span className="text-xs text-muted-foreground">{`${channelLabel(record.channel)} · ${formatRelative(record.recordedAt, locale)}${record.evidence ? ` · ${record.evidence}` : ''}`}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t('answers')} delay={0.16} action={<Button size="xs" variant="outline" onClick={() => setAnswerOpen(true)}>{t('recordAnswer')}</Button>}>
          <ul className="flex flex-col">
            {pagedRows(answers).map((answer) => (
              <li key={answer.id} className="flex items-center justify-between gap-2 border-t border-subtle py-2 text-sm first:border-t-0">
                <span className="font-mono text-xs text-muted-foreground">{answer.questionKey}</span>
                <span className="font-semibold text-foreground">{textOf(answer.value)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <RecordFactDialog partyId={partyId} attributes={attributeList} open={factOpen} onOpenChange={setFactOpen} />
      <RecordConsentDialog partyId={partyId} purposes={(consents.data?.items ?? []).map((item) => ({ purpose: item.purpose, label: item.label }))} open={consentOpen} onOpenChange={setConsentOpen} />
      <RecordAnswerDialog partyId={partyId} open={answerOpen} onOpenChange={setAnswerOpen} />
      <MergeDialog partyId={partyId} open={mergeOpen} onOpenChange={setMergeOpen} />
    </div>
  );
}
