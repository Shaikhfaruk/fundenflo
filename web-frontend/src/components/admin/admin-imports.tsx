'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { KeyValues, Section } from '@/components/data/detail-section';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList, pagedRows } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { Link, useRouter } from '@/i18n/navigation';
import { adminKeys, commitImport, createImport, importBatchQuery, importFieldsQuery, importRowsQuery, importsQuery, inspectImport, mapImport, undoImport, validateImport } from '@/lib/api/admin';
import type { ImportBatch, ImportFields } from '@/lib/api/types/admin.types';
import { IMPORT_ACCEPT, IMPORT_BUSY_STATUSES, IMPORT_STATUSES, ImportKind, ImportStatus } from '@/lib/constants/admin.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime, formatRelative } from '@/lib/format/date';

const JSON_INDENT = 2;

const UNMAPPED = '__none__';

const MAPPABLE: readonly string[] = [ImportStatus.Uploaded, ImportStatus.Mapped, ImportStatus.Validated, ImportStatus.Failed];

const DEFAULT_DEFAULTS = { source: 'import', consent: { basis: 'consent', evidence: '', purposes: ['contact'] } };

const normalise = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

const guessMapping = (fields: ImportFields['fields'], columns: string[]) =>
  Object.fromEntries(fields.flatMap((field) => {
    const column = columns.find((item) => normalise(item) === normalise(field.key) || normalise(item) === normalise(field.label));
    return column ? [[field.key, column]] : [];
  }));

const STATUS_TONE = { ...REVIEW_STATUS_TONE, awaiting_upload: REVIEW_STATUS_TONE.pending, uploaded: REVIEW_STATUS_TONE.offered, mapped: REVIEW_STATUS_TONE.offered, validating: REVIEW_STATUS_TONE.working, validated: REVIEW_STATUS_TONE.accepted, committing: REVIEW_STATUS_TONE.working, committed: REVIEW_STATUS_TONE.completed, undoing: REVIEW_STATUS_TONE.working, undone: REVIEW_STATUS_TONE.expired, failed: REVIEW_STATUS_TONE.rejected };

const title = (row: ImportBatch) => (
  <Link href={RoutePath.adminImport(row.id)} className="truncate font-semibold text-navy hover:underline">
    {row.fileName}
  </Link>
);

export function AdminImports() {
  const t = useTranslations('admin.imports');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const router = useRouter();
  const errorToast = useErrorToast();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>(ANY_VALUE);
  const imports = useInfiniteQuery(importsQuery(anyToUndefined(status)));
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const created = await createImport({ kind: ImportKind.Leads, fileName: file.name });
      const response = await fetch(created.upload.url, { method: created.upload.method, headers: created.upload.headers, body: file });
      if (!response.ok) throw new Error(t('uploadFailed'));
      return inspectImport(created.batch.id);
    },
    meta: { handlesError: true },
    onSuccess: (batch) => {
      toast.success(t('uploaded', { name: batch.fileName }));
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      router.push(RoutePath.adminImport(batch.id));
    },
    onError: (failure) => errorToast(failure),
  });
  const columns: Column<ImportBatch>[] = [
    { key: 'file', header: t('file'), cell: title, hideOnCard: true },
    { key: 'rows', header: t('rows'), cell: (row) => <span className="tabular">{row.counts ? t('rowCounts', { valid: row.counts.valid, invalid: row.counts.invalid, total: row.counts.total }) : '—'}</span> },
    { key: 'committed', header: t('committed'), cell: (row) => <span className="tabular">{row.counts?.committed ?? 0}</span> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(STATUS_TONE, row.status)} namespace="enums.importStatus" /> },
    { key: 'created', header: t('created'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.createdAt, locale)}</span> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <input
              ref={input}
              type="file"
              accept={IMPORT_ACCEPT}
              className="sr-only"
              aria-label={t('choose')}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = '';
              }}
            />
            <Button size="sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Spinner /> : <Icon name="upload-file" size={16} />}
              {t('new')}
            </Button>
          </>
        }
      />
      <FilterBar onRefresh={() => void imports.refetch()} refreshing={imports.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={IMPORT_STATUSES} label={t('status')} allLabel={t('anyStatus')} labelOf={(value) => enumLabel('importStatus', value)} />
      </FilterBar>
      <PagedList result={imports} columns={columns} rowKey={(row) => row.id} title={title} empty={<EmptyState icon="upload-file" title={t('emptyTitle')} body={t('emptyBody')} />} />
    </div>
  );
}

function MappingStep({ batch, fields }: { batch: ImportBatch; fields: ImportFields['fields'] }) {
  const t = useTranslations('admin.imports');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const columns = batch.columns ?? [];
  const [mapping, setMapping] = useState<Record<string, string>>(() => batch.mapping ?? guessMapping(fields, columns));
  const [defaults, setDefaults] = useState(() => JSON.stringify(batch.defaults && Object.keys(batch.defaults).length > 0 ? batch.defaults : DEFAULT_DEFAULTS, null, JSON_INDENT));
  const parsedDefaults = (() => {
    try {
      return { ok: true as const, value: JSON.parse(defaults) as unknown };
    } catch {
      return { ok: false as const };
    }
  })();
  const save = useMutation({
    mutationFn: async () => {
      const mapped = await mapImport(batch.id, { mapping, defaults: parsedDefaults.ok ? parsedDefaults.value : {} }, batch.version);
      return validateImport(mapped.id);
    },
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(adminKeys.importBatch(batch.id), next);
      toast.success(t('validating'));
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <Section title={t('mapping')}>
      <p className="text-sm text-muted-foreground">{t('mappingBody')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <Field key={field.key}>
            <FieldLabel>{field.label}</FieldLabel>
            <Select value={mapping[field.key] ?? UNMAPPED} onValueChange={(value) => setMapping((current) => (String(value) === UNMAPPED ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== field.key)) : { ...current, [field.key]: String(value) }))}>
              <SelectTrigger size="sm" className="h-10 w-full" aria-label={field.label}>
                <SelectValue>{(current: string | null) => (current && current !== UNMAPPED ? current : t('notMapped'))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNMAPPED}>{t('notMapped')}</SelectItem>
                {columns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{field.description}</FieldDescription>
          </Field>
        ))}
      </div>
      <Field data-invalid={!parsedDefaults.ok}>
        <FieldLabel htmlFor="import-defaults">{t('defaults')}</FieldLabel>
        <Textarea id="import-defaults" rows={8} value={defaults} onChange={(event) => setDefaults(event.target.value)} className="font-mono text-xs" spellCheck={false} />
        {parsedDefaults.ok ? <FieldDescription>{t('defaultsHint')}</FieldDescription> : <FieldError>{t('jsonInvalid')}</FieldError>}
      </Field>
      <Button size="sm" className="self-start" disabled={Object.keys(mapping).length === 0 || !parsedDefaults.ok || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Spinner /> : null}
        {t('saveAndValidate')}
      </Button>
    </Section>
  );
}

function RowIssues({ batch }: { batch: ImportBatch }) {
  const t = useTranslations('admin.imports');
  const rows = useInfiniteQuery(importRowsQuery(batch.id));
  const items = pagedRows(rows);
  return (
    <Section title={t('issues')} delay={0.06}>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{t('noIssues')}</p> : null}
      <ul className="flex flex-col">
        {items.map((row) => (
          <li key={row.id} className="flex flex-col gap-0.5 border-t border-subtle py-2 first:border-t-0">
            <span className="text-sm font-semibold text-foreground">{t('rowNumber', { number: row.rowNumber })}</span>
            {row.issues?.errors.map((issue) => (
              <span key={`${issue.code}-${issue.field}`} className="text-xs text-destructive">
                {`${issue.column ?? issue.field}: ${issue.message}`}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {rows.hasNextPage ? (
        <Button variant="ghost" size="xs" className="self-start" onClick={() => void rows.fetchNextPage()} disabled={rows.isFetchingNextPage}>
          {t('more')}
        </Button>
      ) : null}
    </Section>
  );
}

function ImportView({ batch }: { batch: ImportBatch }) {
  const t = useTranslations('admin.imports');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const fields = useQuery(importFieldsQuery(batch.kind));
  const [confirm, setConfirm] = useState<'commit' | 'undo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (kind: 'commit' | 'undo') => (kind === 'commit' ? commitImport(batch.id) : undoImport(batch.id)),
    meta: { handlesError: true },
    onSuccess: (next, kind) => {
      queryClient.setQueryData(adminKeys.importBatch(batch.id), next);
      toast.success(t(kind === 'commit' ? 'committing' : 'undoing'));
      setConfirm(null);
    },
    onError: (failure) => setError(errorText(failure)),
  });
  const busy = IMPORT_BUSY_STATUSES.includes(batch.status);
  const counts = batch.counts;
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.AdminImports} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={batch.fileName}
        description={formatDateTime(batch.createdAt, locale)}
        badge={<StatusBadge status={batch.status} tone={toneOf(STATUS_TONE, batch.status)} namespace="enums.importStatus" />}
        actions={
          <>
            {batch.status === ImportStatus.Validated && (counts?.valid ?? 0) > 0 ? (
              <Button size="sm" onClick={() => setConfirm('commit')}>
                {t('commit', { count: counts?.valid ?? 0 })}
              </Button>
            ) : null}
            {batch.status === ImportStatus.Committed ? (
              <Button size="sm" variant="outline" onClick={() => setConfirm('undo')}>
                {t('undo')}
              </Button>
            ) : null}
          </>
        }
      />
      {busy ? (
        <output className="flex items-center gap-2 rounded-xl bg-subtle px-4 py-3 text-sm text-navy">
          <Spinner className="text-gold" />
          {t('working')}
        </output>
      ) : null}
      {batch.error || error ? (
        <p className="rounded-xl bg-error-soft px-4 py-3 text-sm text-destructive" role="alert">
          {error ?? batch.error}
        </p>
      ) : null}
      {counts ? (
        <Section title={t('summary')}>
          <KeyValues
            columns={3}
            items={[
              { label: t('total'), value: String(counts.total) },
              { label: t('valid'), value: String(counts.valid) },
              { label: t('invalid'), value: String(counts.invalid) },
              { label: t('committed'), value: String(counts.committed) },
              { label: t('failed'), value: String(counts.failed) },
              { label: t('undone'), value: String(counts.undone) },
            ]}
          />
        </Section>
      ) : null}
      {MAPPABLE.includes(batch.status) && fields.data ? <MappingStep key={batch.version} batch={batch} fields={fields.data.fields} /> : null}
      {batch.sampleRows && batch.sampleRows.length > 0 ? (
        <Section title={t('sample')} delay={0.04}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {(batch.columns ?? []).map((column) => (
                    <th key={column} className="border-b border-subtle px-2 py-1.5 font-semibold text-muted-foreground">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batch.sampleRows.map((row, index) => (
                  <tr key={`${batch.id}-${String(index)}`}>
                    {(batch.columns ?? []).map((column) => (
                      <td key={column} className="border-b border-subtle px-2 py-1.5 text-foreground">
                        {row[column] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
      {counts && counts.invalid + counts.failed > 0 ? <RowIssues batch={batch} /> : null}
      <ConfirmDialog open={confirm !== null} onOpenChange={(open) => (open ? null : setConfirm(null))} title={confirm === 'undo' ? t('undoTitle') : t('commitTitle')} description={confirm === 'undo' ? t('undoBody') : t('commitBody')} confirmLabel={confirm === 'undo' ? t('undo') : t('commitShort')} destructive={confirm === 'undo'} pending={run.isPending} onConfirm={() => (confirm ? run.mutate(confirm) : null)} />
    </div>
  );
}

export function AdminImportDetail() {
  const t = useTranslations('admin.imports');
  const { id } = useParams<{ id: string }>();
  const batch = useQuery(importBatchQuery(id, IMPORT_BUSY_STATUSES));
  if (batch.isPending) return <ScreenSkeleton />;
  if (!batch.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <ImportView batch={batch.data} />;
}
