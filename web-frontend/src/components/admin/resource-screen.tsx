'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { DetailSheet } from '@/components/data/detail-sheet';
import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { SearchInput } from '@/components/data/search-input';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { type AdminRecord, adminChildrenQuery, adminKeys, adminRecordQuery, adminResourceQuery, removeAdminRecord, sendAdminRecord } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/api-error';
import { ADMIN_RESOURCES, type ChildSpec, type ColumnSpec, type FieldSpec, type ResourceKey, type ResourceSpec } from '@/lib/constants/admin-resources.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';
import { textOf } from '@/lib/format/fact';
import { pickText } from '@/lib/format/localised';
import { formatPaise } from '@/lib/format/money';

import { buildBody, type FormMode, type FormValue, initialValues, RecordForm } from './record-form';

const SEARCH_MIN_LENGTH = 1;

function useCell() {
  const locale = useLocale();
  const tCommon = useTranslations('admin.common');
  const enumLabel = useEnumLabels();
  return (column: ColumnSpec, row: AdminRecord): ReactNode => {
    const value = row[column.name];
    switch (column.kind) {
      case 'localised':
        return <span className="font-semibold text-navy">{pickText(value as Record<string, string> | null, locale) || '—'}</span>;
      case 'status':
        return typeof value === 'string' ? <StatusBadge status={value} tone={toneOf(REVIEW_STATUS_TONE, value)} /> : '—';
      case 'active':
        return <StatusBadge status={value === true ? 'active' : 'inactive'} tone={toneOf(REVIEW_STATUS_TONE, value === true ? 'active' : 'inactive')} />;
      case 'list':
        return Array.isArray(value) && value.length > 0 ? <span className="text-[13px]">{value.join(', ')}</span> : '—';
      case 'count':
        return Array.isArray(value) ? <span className="tabular">{value.length}</span> : '—';
      case 'money':
        return typeof value === 'number' ? <span className="tabular">{formatPaise(value, locale)}</span> : '—';
      case 'date':
        return typeof value === 'string' ? <span className="text-muted-foreground">{formatDate(value, locale)}</span> : '—';
      case 'enum':
        return typeof value === 'string' ? enumLabel(column.optionsEnum, value) : '—';
      case 'state':
      case 'city':
        return value && typeof value === 'object' && 'name' in value ? textOf(value.name) : '—';
      default:
        return value === null || value === undefined || value === '' ? '—' : typeof value === 'string' || typeof value === 'number' ? String(value) : tCommon('set');
    }
  };
}

const recordId = (spec: { idField: string }, record: AdminRecord) => textOf(record[spec.idField]);

function useTitleOf(spec: ResourceSpec) {
  const locale = useLocale();
  return (record: AdminRecord) => {
    const value = record[spec.titleField];
    return typeof value === 'string' ? value : value && typeof value === 'object' ? pickText(value as Record<string, string>, locale) : recordId(spec, record);
  };
}

type FormSheetProps = { title: string; fields: FieldSpec[]; mode: FormMode; record: AdminRecord | null; pending: boolean; error: string | null; onSubmit: (body: Record<string, unknown>) => void; onClose: () => void; children?: ReactNode; extra?: ReactNode };

function FormSheet({ title, fields, mode, record, pending, error, onSubmit, onClose, children, extra }: FormSheetProps) {
  const t = useTranslations('admin.common');
  const [values, setValues] = useState(() => initialValues(fields, record));
  const [invalid, setInvalid] = useState<string[]>([]);
  const submit = () => {
    const built = buildBody(fields, values, mode, record);
    setInvalid(built.invalid);
    if (built.invalid.length > 0) return;
    if (Object.keys(built.body).length === 0) {
      onClose();
      return;
    }
    onSubmit(built.body);
  };
  return (
    <DetailSheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={title}
      footer={
        <>
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? <Spinner /> : null}
            {mode === 'create' ? t('create') : t('save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          {extra}
        </>
      }
    >
      <RecordForm fields={fields} mode={mode} values={values} invalid={invalid} onChange={(name: string, value: FormValue) => setValues((current) => ({ ...current, [name]: value }))} />
      {error ? (
        <p className="flex items-start gap-1.5 rounded-sm bg-error-soft px-3 py-2 text-xs text-destructive" role="alert">
          <Icon name="error" size={15} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
      {children}
    </DetailSheet>
  );
}

function ChildList({ spec, child, parent }: { spec: ResourceSpec; child: ChildSpec; parent: AdminRecord }) {
  const t = useTranslations(`admin.children.${child.key}`);
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const cell = useCell();
  const parentId = recordId(spec, parent);
  const fetched = useQuery({ ...adminChildrenQuery(spec, child.key, child.list ?? spec.list, parentId), enabled: Boolean(child.list) });
  const rows = child.itemsField ? ((parent[child.itemsField] as AdminRecord[] | undefined) ?? []) : (fetched.data?.items ?? []);
  const [editing, setEditing] = useState<{ mode: FormMode; record: AdminRecord | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!editing) throw new Error('no child');
      if (editing.mode === 'create') return sendAdminRecord(child.create ?? spec.list, { id: parentId }, body);
      const childId = textOf(editing.record?.id);
      const params = child.childParam === 'id' ? { id: childId } : { id: parentId, [child.childParam]: childId };
      return sendAdminRecord(child.update ?? spec.list, params, body, typeof editing.record?.version === 'number' ? editing.record.version : undefined);
    },
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('saved'));
      setEditing(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: adminKeys.resource(spec.key) });
    },
    onError: (failure) => setError(errorText(failure)),
  });
  return (
    <section aria-label={t('title')} className="flex flex-col gap-2 border-t border-subtle pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy">{t('title')}</h3>
        {child.create ? (
          <Button size="xs" variant="outline" onClick={() => setEditing({ mode: 'create', record: null })}>
            <Icon name="add" size={14} />
            {t('add')}
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">{t('empty')}</p> : null}
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={textOf(row.id)} className="flex items-center gap-2 border-t border-subtle py-2 first:border-t-0">
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {child.columns.map((column) => (
                <span key={column.name} className="min-w-0 truncate">
                  {cell(column, row)}
                </span>
              ))}
            </span>
            {child.update ? (
              <Button size="xs" variant="ghost" onClick={() => setEditing({ mode: 'edit', record: row })} aria-label={t('edit')}>
                <Icon name="edit" size={14} />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {editing ? (
        <FormSheet
          key={`${editing.mode}-${textOf(editing.record?.id) || 'new'}`}
          title={editing.mode === 'create' ? t('add') : t('edit')}
          fields={child.fields}
          mode={editing.mode}
          record={editing.record}
          pending={save.isPending}
          error={error}
          onSubmit={(body) => save.mutate(body)}
          onClose={() => {
            setEditing(null);
            setError(null);
          }}
        />
      ) : null}
    </section>
  );
}

function RecordEditor({ spec, row, onClose }: { spec: ResourceSpec; row: AdminRecord; onClose: () => void }) {
  const t = useTranslations(`admin.resources.${spec.key}`);
  const tCommon = useTranslations('admin.common');
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const titleOf = useTitleOf(spec);
  const id = recordId(spec, row);
  const fresh = useQuery({ ...adminRecordQuery(spec, id), enabled: Boolean(spec.get) });
  const record = fresh.data ?? row;
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.resource(spec.key) });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (spec.updateWithCreate) return sendAdminRecord(spec.create ?? spec.list, {}, { ...body, [spec.idField]: id });
      return sendAdminRecord(spec.update ?? spec.list, { id }, body, typeof record.version === 'number' ? record.version : undefined);
    },
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(tCommon('saved'));
      void refresh();
      onClose();
    },
    onError: (failure) => setError(errorText(failure)),
  });
  const remove = useMutation({
    mutationFn: () => removeAdminRecord(spec.remove ?? spec.list, id),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(tCommon('removed'));
      void refresh();
      onClose();
    },
    onError: (failure) => setError(errorText(failure)),
  });
  const editable = Boolean(spec.update) || Boolean(spec.updateWithCreate);
  if (spec.get && fresh.isPending) {
    return (
      <DetailSheet open onOpenChange={(open) => (open ? null : onClose())} title={titleOf(row)}>
        <Spinner className="size-6 self-center text-gold" />
      </DetailSheet>
    );
  }
  const removeButton = spec.remove ? (
    <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => setRemoving(true)}>
      {t('remove')}
    </Button>
  ) : null;
  const children = (
    <>
      {spec.children?.map((child) => (
        <ChildList key={child.key} spec={spec} child={child} parent={record} />
      ))}
      <ConfirmDialog open={removing} onOpenChange={setRemoving} title={t('removeTitle', { name: titleOf(record) })} description={t('removeBody')} confirmLabel={t('remove')} destructive pending={remove.isPending} onConfirm={() => remove.mutate()} />
    </>
  );
  if (!editable) {
    return (
      <DetailSheet open onOpenChange={(open) => (open ? null : onClose())} title={titleOf(record)} footer={removeButton}>
        {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
        {children}
      </DetailSheet>
    );
  }
  return (
    <FormSheet key={textOf(record.version) || id} title={titleOf(record)} fields={spec.fields} mode="edit" record={record} pending={save.isPending} error={error} onSubmit={(body) => save.mutate(body)} onClose={onClose} extra={removeButton}>
      {children}
    </FormSheet>
  );
}

function SecretDialog({ secret, onClose }: { secret: string; onClose: () => void }) {
  const t = useTranslations('admin.common');
  return (
    <ConfirmDialog open onOpenChange={(open) => (open ? null : onClose())} title={t('secretTitle')} description={t('secretBody')} confirmLabel={t('secretDone')} onConfirm={onClose}>
      <p className="rounded-lg bg-subtle p-3 font-mono text-sm break-all text-navy select-all">{secret}</p>
    </ConfirmDialog>
  );
}

export function AdminResourceScreen({ resource, tabs }: { resource: ResourceKey; tabs?: ReactNode }) {
  const spec = ADMIN_RESOURCES[resource];
  const t = useTranslations(`admin.resources.${resource}`);
  const tFields = useTranslations('admin.fields');
  const tCommon = useTranslations('admin.common');
  const enumLabel = useEnumLabels();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const cell = useCell();
  const titleOf = useTitleOf(spec);
  const [filters, setFilters] = useState<Record<string, string>>(() => Object.fromEntries((spec.filters ?? []).map((filter) => [filter.name, filter.initial ?? ANY_VALUE])));
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState<AdminRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const query = {
    ...Object.fromEntries(Object.entries(filters).map(([name, value]) => [name, anyToUndefined(value)])),
    ...(spec.search && search.trim().length >= SEARCH_MIN_LENGTH ? { [spec.search]: search.trim() } : {}),
  };
  const list = useInfiniteQuery(adminResourceQuery(spec, query));
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => sendAdminRecord(spec.create ?? spec.list, {}, body),
    meta: { handlesError: true },
    onSuccess: (result) => {
      toast.success(t('created'));
      setCreating(false);
      setCreateError(null);
      void queryClient.invalidateQueries({ queryKey: adminKeys.resource(spec.key) });
      const value = spec.secretField ? result[spec.secretField] : undefined;
      if (typeof value === 'string') setSecret(value);
    },
    onError: (failure) => setCreateError(failure instanceof ApiError && failure.fieldIssues[0] ? `${tFields.has(failure.fieldIssues[0].path) ? tFields(failure.fieldIssues[0].path) : failure.fieldIssues[0].path}: ${failure.fieldIssues[0].message}` : errorText(failure)),
  });
  const openButton = (row: AdminRecord) => (
    <button type="button" onClick={() => setOpened(row)} className="max-w-full truncate text-left font-semibold text-navy hover:underline focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none">
      {titleOf(row) || '—'}
    </button>
  );
  const columns: Column<AdminRecord>[] = spec.columns.map((column, index) => ({
    key: column.name,
    header: tFields.has(column.labelKey ?? column.name) ? tFields(column.labelKey ?? column.name) : column.name,
    cell: (row) => (index === 0 ? openButton(row) : cell(column, row)),
    hideOnCard: index === 0,
  }));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          spec.create ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Icon name="add" size={16} />
              {t('add')}
            </Button>
          ) : null
        }
      />
      {tabs}
      {(spec.filters?.length ?? 0) > 0 || spec.search ? (
        <FilterBar onRefresh={() => void list.refetch()} refreshing={list.isFetching}>
          {spec.search ? <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tCommon('search')} aria-label={tCommon('search')} className="sm:w-64" /> : null}
          {spec.filters?.map((filter) => (
            <EnumSelect key={filter.name} value={filters[filter.name] ?? ANY_VALUE} onChange={(value) => setFilters((current) => ({ ...current, [filter.name]: value }))} values={filter.options} label={tFields.has(filter.labelKey ?? filter.name) ? tFields(filter.labelKey ?? filter.name) : filter.name} allLabel={tCommon('any')} labelOf={(value) => enumLabel(filter.optionsEnum, value)} className="sm:w-44" />
          ))}
        </FilterBar>
      ) : null}
      <PagedList result={list} columns={columns} rowKey={(row) => recordId(spec, row)} title={openButton} empty={<EmptyState icon="database" title={t('emptyTitle')} body={t('emptyBody')} />} />
      {opened ? <RecordEditor key={recordId(spec, opened)} spec={spec} row={opened} onClose={() => setOpened(null)} /> : null}
      {creating ? (
        <FormSheet
          title={t('add')}
          fields={spec.fields}
          mode="create"
          record={null}
          pending={create.isPending}
          error={createError}
          onSubmit={(body) => create.mutate(body)}
          onClose={() => {
            setCreating(false);
            setCreateError(null);
          }}
        />
      ) : null}
      {secret ? <SecretDialog secret={secret} onClose={() => setSecret(null)} /> : null}
    </div>
  );
}
