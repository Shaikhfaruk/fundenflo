'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { KeyValues, Section } from '@/components/data/detail-section';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import {
  adminConfigKeys,
  configDocumentQuery,
  configVersionQuery,
  createConfigVersion,
  previewQuestionSet,
  publishConfigVersion,
  retireConfigVersion,
  simulateLenderProduct,
  simulateRouting,
  submitConfigVersion,
  updateConfigDocument,
  updateConfigDraft,
} from '@/lib/api/admin-config';
import type { ConfigDocument, ConfigVersion } from '@/lib/api/types/admin-config.types';
import { CatalogStatus, ConfigAction, CONFIG_NOTE_MAX_LENGTH, CONFIG_NOTE_MIN_LENGTH, CONFIG_RESOURCE_META, ConfigResource } from '@/lib/constants/admin.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime, toLocalDateTime } from '@/lib/format/date';
import { pickText } from '@/lib/format/localised';

const JSON_INDENT = 2;

const VERSION_PARAM = 'v';

const pretty = (value: unknown) => JSON.stringify(value ?? {}, null, JSON_INDENT);

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
};

const TRY_OUT: Partial<Record<ConfigResource, (id: string, number: number, body: unknown) => Promise<unknown>>> = {
  [ConfigResource.LenderProduct]: simulateLenderProduct,
  [ConfigResource.QuestionSet]: previewQuestionSet,
  [ConfigResource.RoutingRule]: (_id, _number, body) => simulateRouting(body),
};

const TRY_OUT_INPUT: Partial<Record<ConfigResource, unknown>> = {
  [ConfigResource.LenderProduct]: { profiles: [] },
  [ConfigResource.QuestionSet]: { segment: 'msme', facts: {} },
  [ConfigResource.RoutingRule]: { leadId: '' },
};

function TryOut({ resource, version }: { resource: ConfigResource; version: ConfigVersion }) {
  const t = useTranslations('admin.config');
  const errorText = useErrorText();
  const inputId = useId();
  const [input, setInput] = useState(pretty(TRY_OUT_INPUT[resource] ?? {}));
  const [result, setResult] = useState<string | null>(null);
  const parsed = parseJson(input);
  const run = TRY_OUT[resource];
  const call = useMutation({
    mutationFn: () => (run && parsed.ok ? run(version.documentId, version.number, parsed.value) : Promise.resolve(null)),
    meta: { handlesError: true },
    onSuccess: (value) => setResult(pretty(value)),
    onError: (failure) => setResult(errorText(failure)),
  });
  if (!run) return null;
  return (
    <Section title={t(`tryTitle.${resource}`)} delay={0.12}>
      <Field data-invalid={!parsed.ok}>
        <FieldLabel htmlFor={inputId}>{t('tryInput')}</FieldLabel>
        <Textarea id={inputId} rows={6} value={input} onChange={(event) => setInput(event.target.value)} className="font-mono text-xs" spellCheck={false} />
        {parsed.ok ? null : <FieldError>{t('jsonInvalid')}</FieldError>}
      </Field>
      <Button size="sm" variant="outline" className="self-start" disabled={!parsed.ok || call.isPending} onClick={() => call.mutate()}>
        {call.isPending ? <Spinner /> : <Icon name="sparkle" size={16} />}
        {t('run')}
      </Button>
      {result ? <pre className="max-h-96 overflow-auto rounded-lg bg-subtle p-3 font-mono text-xs text-navy">{result}</pre> : null}
    </Section>
  );
}

function VersionPanel({ resource, document, version }: { resource: ConfigResource; document: ConfigDocument; version: ConfigVersion }) {
  const t = useTranslations('admin.config');
  const tStatus = useTranslations('enums.configStatus');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const contentId = useId();
  const notesId = useId();
  const effectiveId = useId();
  const [content, setContent] = useState(pretty(version.content));
  const [notes, setNotes] = useState(version.notes ?? '');
  const [dialog, setDialog] = useState<'submit' | 'retire' | 'publish' | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [now] = useState(() => Date.now());
  const parsed = parseJson(content);
  const can = (action: string) => version.availableActions.includes(action);
  const editable = can(ConfigAction.Edit);
  const dirty = content !== pretty(version.content) || notes !== (version.notes ?? '');
  const refresh = (next?: ConfigVersion) => {
    if (next) queryClient.setQueryData(adminConfigKeys.version(resource, document.id, next.number), next);
    void queryClient.invalidateQueries({ queryKey: adminConfigKeys.document(resource, document.id) });
    void queryClient.invalidateQueries({ queryKey: adminConfigKeys.all });
  };
  const options = { meta: { handlesError: true }, onError: (failure: Error) => errorToast(failure) };
  const save = useMutation({
    ...options,
    mutationFn: () => updateConfigDraft(resource, document.id, version.number, { content: parsed.ok ? parsed.value : undefined, notes: notes.trim() ? notes.trim() : null }, version.version),
    onSuccess: (next) => {
      toast.success(next.issues.length > 0 ? t('savedWithIssues', { count: next.issues.length }) : t('saved'));
      refresh(next);
    },
  });
  const submit = useMutation({
    ...options,
    mutationFn: (reason: string) => submitConfigVersion(resource, document.id, version.number, reason, version.version),
    onSuccess: (next) => {
      toast.success(t('submitted'));
      setDialog(null);
      refresh(next);
    },
  });
  const publish = useMutation({
    ...options,
    mutationFn: () => publishConfigVersion(resource, document.id, version.number, effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined),
    onSuccess: (next) => {
      toast.success(t('published'));
      setDialog(null);
      refresh(next);
    },
  });
  const retire = useMutation({
    ...options,
    mutationFn: (reason: string) => retireConfigVersion(resource, document.id, version.number, reason),
    onSuccess: (next) => {
      toast.success(t('retired'));
      setDialog(null);
      refresh(next);
    },
  });
  const branch = useMutation({
    ...options,
    mutationFn: () => createConfigVersion(resource, document.id, { fromNumber: version.number }),
    onSuccess: (next) => {
      toast.success(t('branched', { number: next.number }));
      refresh(next);
      router.push(`${CONFIG_RESOURCE_META[resource].path}/${document.id}?${VERSION_PARAM}=${next.number}`);
    },
  });
  return (
    <>
      <Section
        title={t('versionTitle', { number: version.number })}
        action={<StatusBadge status={version.status} tone={toneOf(REVIEW_STATUS_TONE, version.status)} namespace="enums.configStatus" />}
      >
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <Button size="sm" variant="outline" disabled={!dirty || !parsed.ok || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Spinner /> : <Icon name="check" size={16} />}
              {t('saveDraft')}
            </Button>
          ) : null}
          {can(ConfigAction.Submit) ? (
            <Button size="sm" disabled={dirty || version.issues.length > 0} onClick={() => setDialog('submit')}>
              {t('submit')}
            </Button>
          ) : null}
          {version.changeRequest && can(ConfigAction.Approve) ? (
            <ButtonLink href={RoutePath.adminChangeRequest(version.changeRequest.id)} size="sm">
              {t('review')}
            </ButtonLink>
          ) : null}
          {can(ConfigAction.Publish) ? (
            <Button size="sm" onClick={() => setDialog('publish')}>
              {t('publish')}
            </Button>
          ) : null}
          {!document.openVersion ? (
            <Button size="sm" variant="outline" disabled={branch.isPending} onClick={() => branch.mutate()}>
              {t('branch')}
            </Button>
          ) : null}
          {can(ConfigAction.Retire) ? (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDialog('retire')}>
              {t('retire')}
            </Button>
          ) : null}
        </div>
        {version.issues.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-lg bg-error-soft p-3" aria-label={t('issues')}>
            {version.issues.map((issue) => (
              <li key={`${issue.path}-${issue.code}`} className="text-xs text-destructive">
                <span className="font-mono font-semibold">{issue.path || '$'}</span> {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        <Field data-invalid={!parsed.ok}>
          <FieldLabel htmlFor={contentId}>{t('content')}</FieldLabel>
          <Textarea id={contentId} rows={22} value={content} readOnly={!editable} onChange={(event) => setContent(event.target.value)} className="max-h-[70dvh] overflow-y-auto font-mono text-xs" spellCheck={false} />
          {parsed.ok ? <FieldDescription>{editable ? t('editHint') : t('readOnly', { status: tStatus.has(version.status) ? tStatus(version.status) : version.status })}</FieldDescription> : <FieldError>{t('jsonInvalid')}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor={notesId}>{t('notes')}</FieldLabel>
          <Input id={notesId} value={notes} readOnly={!editable} maxLength={CONFIG_NOTE_MAX_LENGTH} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <KeyValues
          columns={3}
          items={[
            { label: t('created'), value: formatDateTime(version.createdAt, locale) },
            { label: t('effectiveFrom'), value: formatDateTime(version.effectiveFrom, locale) },
            { label: t('publishedAt'), value: formatDateTime(version.publishedAt, locale) },
            { label: t('changeRequest'), value: version.changeRequest ? <Link href={RoutePath.adminChangeRequest(version.changeRequest.id)} className="font-semibold text-gold-deep hover:underline">{version.changeRequest.reason}</Link> : '—' },
            { label: t('hash'), value: <span className="font-mono text-xs break-all">{version.contentHash ?? '—'}</span> },
            { label: t('retiredAt'), value: formatDateTime(version.retiredAt, locale) },
          ]}
        />
      </Section>
      <TryOut resource={resource} version={version} />
      <ReasonDialog open={dialog === 'submit'} onOpenChange={(open) => setDialog(open ? 'submit' : null)} title={t('submitTitle')} description={t('submitBody')} label={t('reason')} confirmLabel={t('submit')} pending={submit.isPending} minLength={CONFIG_NOTE_MIN_LENGTH} maxLength={CONFIG_NOTE_MAX_LENGTH} onConfirm={(reason) => submit.mutate(reason)} />
      <ReasonDialog open={dialog === 'retire'} onOpenChange={(open) => setDialog(open ? 'retire' : null)} title={t('retireTitle')} description={t('retireBody')} label={t('reason')} confirmLabel={t('retire')} destructive pending={retire.isPending} minLength={CONFIG_NOTE_MIN_LENGTH} maxLength={CONFIG_NOTE_MAX_LENGTH} onConfirm={(reason) => retire.mutate(reason)} />
      <ConfirmDialog open={dialog === 'publish'} onOpenChange={(open) => setDialog(open ? 'publish' : null)} title={t('publishTitle')} description={t('publishBody')} confirmLabel={t('publish')} pending={publish.isPending} onConfirm={() => publish.mutate()}>
        <Field>
          <FieldLabel htmlFor={effectiveId}>{t('effectiveFromOptional')}</FieldLabel>
          <Input id={effectiveId} type="datetime-local" min={toLocalDateTime(now)} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </>
  );
}

function DocumentSettings({ resource, document }: { resource: ConfigResource; document: ConfigDocument }) {
  const t = useTranslations('admin.config');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const nameId = useId();
  const [name, setName] = useState(pickText(document.name, locale));
  const update = useMutation({
    mutationFn: (body: { name?: Record<string, string>; status?: string }) => updateConfigDocument(resource, document.id, body, document.version),
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(adminConfigKeys.document(resource, document.id), next);
      void queryClient.invalidateQueries({ queryKey: adminConfigKeys.all });
      toast.success(t('documentSaved'));
    },
    onError: (failure) => errorToast(failure),
  });
  const active = document.status === CatalogStatus.Active;
  return (
    <Section title={t('document')} delay={0.04}>
      <Field>
        <FieldLabel htmlFor={nameId}>{t('name')}</FieldLabel>
        <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={name.trim().length < 2 || name.trim() === pickText(document.name, locale) || update.isPending} onClick={() => update.mutate({ name: { ...document.name, [locale]: name.trim() } })}>
          {t('saveName')}
        </Button>
        <Button size="sm" variant="ghost" className={active ? 'text-destructive' : undefined} disabled={update.isPending} onClick={() => update.mutate({ status: active ? CatalogStatus.Inactive : CatalogStatus.Active })}>
          {active ? t('deactivate') : t('activate')}
        </Button>
      </div>
      <ul className="flex flex-col">
        {document.versions.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 border-t border-subtle py-2 first:border-t-0">
            <Link href={`${CONFIG_RESOURCE_META[resource].path}/${document.id}?${VERSION_PARAM}=${item.number}`} className="text-sm font-semibold text-navy hover:underline">
              {t('versionNumber', { number: item.number })}
            </Link>
            <StatusBadge status={item.status} tone={toneOf(REVIEW_STATUS_TONE, item.status)} namespace="enums.configStatus" />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ConfigDocumentScreen({ resource }: { resource: ConfigResource }) {
  const t = useTranslations('admin.config');
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const document = useQuery(configDocumentQuery(resource, id));
  const requested = Number(search.get(VERSION_PARAM));
  const fallback = document.data?.openVersion?.number ?? document.data?.activeVersion?.number ?? document.data?.versions[0]?.number;
  const number = Number.isInteger(requested) && requested > 0 ? requested : fallback;
  const version = useQuery({ ...configVersionQuery(resource, id, number ?? 1), enabled: number !== undefined });
  if (document.isPending) return <ScreenSkeleton />;
  if (!document.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  const data = document.data;
  return (
    <div className="flex flex-col gap-4">
      <Link href={CONFIG_RESOURCE_META[resource].path} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader eyebrow={data.key} title={pickText(data.name, locale) || data.key} description={data.activeVersion ? t('liveVersion', { number: data.activeVersion.number }) : t('noLive')} badge={<StatusBadge status={data.status} tone={toneOf(REVIEW_STATUS_TONE, data.status)} />} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">{version.data ? <VersionPanel key={`${version.data.id}-${version.data.version}`} resource={resource} document={data} version={version.data} /> : <ScreenSkeleton />}</div>
        <DocumentSettings key={data.version} resource={resource} document={data} />
      </div>
    </div>
  );
}
