'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { useEventText } from '@/components/borrower/application-activity';
import { useCategoryLabel } from '@/components/borrower/category-labels';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { KeyValues, Section } from '@/components/data/detail-section';
import { pagedRows } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { FactValueInput } from '@/components/ops/fact-value-input';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { assignCase, attributesQuery, documentTypesQuery, opsCaseKeys, opsCaseQuery, opsSubmissionsQuery, recomputeAssessment, requestCaseDocuments, verifyCaseFact } from '@/lib/api/ops-cases';
import { partyFactsQuery } from '@/lib/api/ops-parties';
import type { AttributeDefinition } from '@/lib/api/types/admin.types';
import type { OpsCaseDetail, PartyFact } from '@/lib/api/types/ops.types';
import { DOCUMENT_REQUEST_DUE_DAYS, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH, RecomputeMode } from '@/lib/constants/ops.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { APPLICATION_STATUS_TONE, DOCUMENT_STATUS_TONE, REVIEW_STATUS_TONE, SUBMISSION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate, formatRelative } from '@/lib/format/date';
import { factInputOf, formatFactValue, parseFactInput } from '@/lib/format/fact';
import { pickText } from '@/lib/format/localised';
import { formatPaise } from '@/lib/format/money';
import { useMe } from '@/lib/session/use-me';

function VerifyFactDialog({ caseId, fact, attribute, onClose }: { caseId: string; fact: PartyFact | null; attribute: AttributeDefinition | undefined; onClose: () => void }) {
  const t = useTranslations('ops.caseDetail');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const valueId = useId();
  const reasonId = useId();
  const [value, setValue] = useState(() => factInputOf(fact?.value, attribute));
  const [reason, setReason] = useState('');
  const parsed = parseFactInput(value, attribute);
  const verify = useMutation({
    mutationFn: () => verifyCaseFact(caseId, fact?.attributeKey ?? '', { value: parsed.ok ? parsed.value : null, reason: reason.trim() }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('factVerified'));
      void queryClient.invalidateQueries({ queryKey: ['ops-parties'] });
      void queryClient.invalidateQueries({ queryKey: opsCaseKeys.detail(caseId) });
      onClose();
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={fact !== null} onOpenChange={(open) => (open ? null : onClose())} title={t('verifyTitle', { name: pickText(attribute?.label, 'en') || (fact?.attributeKey ?? '') })} description={t('verifyBody')} confirmLabel={t('verify')} pending={verify.isPending} confirmDisabled={!parsed.ok || reason.trim().length < LEAD_NOTE_MIN_LENGTH} onConfirm={() => verify.mutate()}>
      <Field>
        <FieldLabel htmlFor={valueId}>{t('verifiedValue')}</FieldLabel>
        <FactValueInput id={valueId} attribute={attribute} value={value} onChange={setValue} label={t('verifiedValue')} />
      </Field>
      <Field>
        <FieldLabel htmlFor={reasonId}>{t('evidence')}</FieldLabel>
        <Textarea id={reasonId} rows={2} value={reason} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function RequestDocumentsDialog({ caseId, open, onOpenChange }: { caseId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ops.caseDetail');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const noteId = useId();
  const daysId = useId();
  const types = useQuery({ ...documentTypesQuery(), enabled: open });
  const [chosen, setChosen] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [days, setDays] = useState(String(DOCUMENT_REQUEST_DUE_DAYS));
  const request = useMutation({
    mutationFn: () => requestCaseDocuments(caseId, { documentTypes: chosen, note: note.trim() || undefined, dueInDays: Number(days) || undefined }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('requested'));
      setChosen([]);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: opsCaseKeys.detail(caseId) });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  const toggle = (key: string) => setChosen((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('requestTitle')} description={t('requestBody')} confirmLabel={t('sendRequest')} pending={request.isPending} confirmDisabled={chosen.length === 0 || (note.trim().length > 0 && note.trim().length < LEAD_NOTE_MIN_LENGTH)} onConfirm={() => request.mutate()}>
      <ChipGroup label={t('documentTypes')} showLabel>
        {(types.data?.items ?? [])
          .filter((type) => type.status === 'active')
          .map((type) => (
            <ChoiceChip key={type.key} selected={chosen.includes(type.key)} label={pickText(type.label, locale) || type.key} onToggle={() => toggle(type.key)} className="min-h-9 text-[13px]" />
          ))}
      </ChipGroup>
      <Field>
        <FieldLabel htmlFor={noteId}>{t('noteForBorrower')}</FieldLabel>
        <Textarea id={noteId} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={daysId}>{t('dueInDays')}</FieldLabel>
        <Input id={daysId} inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value.replaceAll(/\D/g, '').slice(0, 2))} className="w-24 tabular" />
      </Field>
    </ConfirmDialog>
  );
}

function CaseView({ detail }: { detail: OpsCaseDetail }) {
  const t = useTranslations('ops.caseDetail');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('status');
  const tJourney = useTranslations('journey');
  const tBlockers = useTranslations('borrower.blockers');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const categoryLabel = useCategoryLabel();
  const channelLabel = useEnumLabel('channel');
  const roleLabel = useEnumLabel('partyRole');
  const provenanceLabel = useEnumLabel('provenance');
  const eventText = useEventText();
  const { data: me } = useMe();
  const { application, parties, documents, nextStep, consents, timeline } = detail;
  const partyId = application.party.id;
  const facts = useQuery(partyFactsQuery(partyId));
  const attributes = useQuery(attributesQuery());
  const submissions = useInfiniteQuery(opsSubmissionsQuery({ applicationId: application.id }));
  const [verifying, setVerifying] = useState<PartyFact | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const attributeOf = (key: string) => attributes.data?.items.find((item) => item.key === key);
  const yesNo = { yes: tCommon('yes'), no: tCommon('no') };
  const refresh = () => queryClient.invalidateQueries({ queryKey: opsCaseKeys.detail(application.id) });
  const assign = useMutation({
    mutationFn: (assigneeUserId: string | null) => assignCase(application.id, assigneeUserId),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('assignmentSaved'));
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const recompute = useMutation({
    mutationFn: (mode: string) => recomputeAssessment(application.assessment.scoreResultId ?? '', mode),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('recomputed'));
      setRecomputeOpen(false);
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const assignedToMe = me?.id !== undefined && application.assigneeUserId === me.id;
  const caseSubmissions = pagedRows(submissions);
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.OpsCases} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={application.ref}
        title={application.party.displayName ?? application.actingParty.displayName ?? application.ref}
        badge={<StatusBadge status={application.status} tone={toneOf(APPLICATION_STATUS_TONE, application.status)} />}
        actions={
          <>
            {assignedToMe ? (
              <Button variant="outline" size="sm" onClick={() => assign.mutate(null)} disabled={assign.isPending}>
                {t('unassign')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => assign.mutate(me?.id ?? null)} disabled={assign.isPending || !me}>
                <Icon name="person" size={16} />
                {t('assignToMe')}
              </Button>
            )}
            <Button size="sm" onClick={() => setRequestOpen(true)}>
              <Icon name="document" size={16} />
              {t('requestDocuments')}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('summary')}>
            <KeyValues
              columns={3}
              items={[
                { label: t('category'), value: categoryLabel(application.categoryKey) || '—' },
                { label: t('amount'), value: <span className="tabular">{formatPaise(application.amountPaise, locale)}</span> },
                { label: t('tenure'), value: application.tenureMonths ? t('months', { count: application.tenureMonths }) : '—' },
                { label: t('city'), value: application.location.city?.name ?? '—' },
                { label: t('channel'), value: channelLabel(application.channel) },
                { label: t('started'), value: formatDate(application.createdAt, locale) },
                { label: t('stage'), value: tJourney.has(application.journeyStage) ? tJourney(application.journeyStage) : application.journeyStage },
                { label: t('assignee'), value: application.assigneeUserId ? (assignedToMe ? t('you') : t('someoneElse')) : t('unassigned') },
                { label: t('scored'), value: application.assessment.scoredAt ? formatRelative(application.assessment.scoredAt, locale) : t('notYet') },
              ]}
            />
            {nextStep.blockers.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-lg bg-gold-soft p-3 text-[13px] text-[#5d4200]">
                {nextStep.blockers.map((blocker) => (
                  <li key={blocker.code} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-gold-deep" aria-hidden="true" />
                    {tBlockers.has(blocker.code) ? tBlockers(blocker.code, { count: blocker.details.length }) : blocker.code}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
          <Section title={t('documents')} delay={0.04}>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noDocuments')}</p>
            ) : (
              <ul className="flex flex-col">
                {documents.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center gap-3 border-t border-subtle py-2.5 first:border-t-0">
                    <Icon name="document" size={18} className="text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">{pickText(document.documentType.label, locale) || document.documentType.key}</span>
                      <span className="truncate text-xs text-muted-foreground">{t('fileLine', { name: document.fileName, when: formatRelative(document.createdAt, locale) })}</span>
                    </span>
                    <StatusBadge status={document.status} tone={toneOf(DOCUMENT_STATUS_TONE, document.status)} />
                    <Link href={RoutePath.opsDocument(document.id)} className="text-xs font-semibold text-gold-deep hover:underline">
                      {document.status === 'needs_review' ? t('review') : t('open')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t('facts')} delay={0.08} action={<Link href={RoutePath.opsParty(partyId)} className="text-xs font-semibold text-gold-deep hover:underline">{t('allFacts')}</Link>}>
            {(facts.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noFacts')}</p>
            ) : (
              <ul className="flex flex-col">
                {(facts.data?.items ?? []).map((fact) => {
                  const attribute = attributeOf(fact.attributeKey);
                  return (
                    <li key={fact.factId} className="flex flex-wrap items-center gap-3 border-t border-subtle py-2.5 first:border-t-0">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-foreground">{pickText(attribute?.label, locale) || fact.attributeKey}</span>
                        <span className="text-xs text-muted-foreground">{t('factLine', { provenance: provenanceLabel(fact.provenance), when: formatRelative(fact.observedAt, locale) })}</span>
                      </span>
                      <span className="text-sm font-semibold text-navy tabular">{formatFactValue(fact.value, attribute, locale, yesNo)}</span>
                      {fact.provenance === 'ops_verified' ? (
                        <Icon name="verified" size={18} className="text-success" label={t('verifiedByOps')} />
                      ) : (
                        <Button variant="secondary" size="xs" onClick={() => setVerifying(fact)}>
                          {t('verify')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
          <Section title={t('timeline')} delay={0.12}>
            <ol className="flex flex-col">
              {timeline.slice(0, 20).map((event) => (
                <li key={event.id} className="flex items-start gap-3 border-t border-subtle py-2 first:border-t-0">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-navy" aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-foreground">{eventText(event)}</span>
                    <span className="text-xs text-muted-foreground">{formatRelative(event.createdAt, locale)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('submissions')} delay={0.04}>
            {caseSubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noSubmissions')}</p>
            ) : (
              <ul className="flex flex-col">
                {caseSubmissions.map((submission) => (
                  <li key={submission.id} className="border-t border-subtle first:border-t-0">
                    <Link href={RoutePath.opsSubmission(submission.id)} className="flex items-center gap-2 py-2.5">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-foreground">{submission.lender.name ?? submission.product.name}</span>
                        <span className="text-xs text-muted-foreground tabular">{submission.ref}</span>
                      </span>
                      <StatusBadge status={submission.status} tone={toneOf(SUBMISSION_STATUS_TONE, submission.status)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t('assessment')} delay={0.08}>
            {application.assessment.scoreResultId ? (
              <>
                <p className="text-sm text-muted-foreground">{t('assessedOn', { date: formatDate(application.assessment.scoredAt, locale) })}</p>
                <Button variant="outline" size="sm" className="self-start" onClick={() => setRecomputeOpen(true)}>
                  <Icon name="refresh" size={16} />
                  {t('recompute')}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('notScored')}</p>
            )}
          </Section>
          <Section title={t('parties')} delay={0.12}>
            <ul className="flex flex-col">
              {parties.map((party) => (
                <li key={party.id} className="flex items-center gap-2 border-t border-subtle py-2.5 first:border-t-0">
                  <Link href={RoutePath.opsParty(party.party.id)} className="flex min-w-0 flex-1 flex-col hover:underline">
                    <span className="truncate text-sm font-semibold text-foreground">{party.party.displayName ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">{roleLabel(party.role)}</span>
                  </Link>
                  <StatusBadge status={party.consentStatus} tone={toneOf(REVIEW_STATUS_TONE, party.consentStatus)} />
                </li>
              ))}
              <li className="flex items-center gap-2 border-t border-subtle py-2.5">
                <Link href={RoutePath.opsParty(application.actingParty.id)} className="flex min-w-0 flex-1 flex-col hover:underline">
                  <span className="truncate text-sm font-semibold text-foreground">{application.actingParty.displayName ?? t('applicant')}</span>
                  <span className="text-xs text-muted-foreground">{t('actingPerson')}</span>
                </Link>
              </li>
            </ul>
          </Section>
          <Section title={t('consents')} delay={0.16}>
            <ul className="flex flex-col gap-1.5">
              {consents.map((consent) => (
                <li key={consent.purpose} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{consent.label}</span>
                  <span className={consent.granted ? 'text-xs font-semibold text-success' : 'text-xs text-muted-foreground'}>{consent.granted ? tStatus('ok') : consent.lastRecordId ? t('declined') : t('notAsked')}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
      {verifying ? <VerifyFactDialog key={verifying.factId} caseId={application.id} fact={verifying} attribute={attributeOf(verifying.attributeKey)} onClose={() => setVerifying(null)} /> : null}
      <RequestDocumentsDialog caseId={application.id} open={requestOpen} onOpenChange={setRequestOpen} />
      <ReasonDialog
        open={recomputeOpen}
        onOpenChange={setRecomputeOpen}
        title={t('recomputeTitle')}
        description={t('recomputeBody')}
        label={t('recomputeNote')}
        confirmLabel={t('recompute')}
        pending={recompute.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        noteOptional
        options={[
          { value: RecomputeMode.Reproduce, label: t('modeReproduce') },
          { value: RecomputeMode.Current, label: t('modeCurrent') },
        ]}
        optionsLabel={t('mode')}
        onConfirm={(_note, mode) => recompute.mutate(mode ?? RecomputeMode.Reproduce)}
      />
    </div>
  );
}

export function OpsCaseDetail() {
  const t = useTranslations('ops.caseDetail');
  const { id } = useParams<{ id: string }>();
  const detail = useQuery(opsCaseQuery(id));
  if (detail.isPending) return <ScreenSkeleton />;
  if (!detail.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <CaseView detail={detail.data} />;
}
