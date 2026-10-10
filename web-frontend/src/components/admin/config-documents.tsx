'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { DetailSheet } from '@/components/data/detail-sheet';
import { EmptyState } from '@/components/data/empty-state';
import { anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { Link, useRouter } from '@/i18n/navigation';
import { adminConfigKeys, configDocumentsQuery, createConfigDocument } from '@/lib/api/admin-config';
import type { ConfigDocument } from '@/lib/api/types/admin-config.types';
import { CATALOG_STATUSES, CatalogStatus, CONFIG_KEY_PATTERN, CONFIG_RESOURCE_META, type ConfigResource } from '@/lib/constants/admin.constants';
import { DEFAULT_LOCALE } from '@/lib/constants/locale.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';
import { pickText } from '@/lib/format/localised';

const JSON_INDENT = 2;

const configDocumentHref = (resource: ConfigResource, id: string) => `${CONFIG_RESOURCE_META[resource].path}/${id}`;

function CreateSheet({ resource, onClose }: { resource: ConfigResource; onClose: () => void }) {
  const t = useTranslations('admin.config');
  const errorText = useErrorText();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(JSON.stringify({}, null, JSON_INDENT));
  const [error, setError] = useState<string | null>(null);
  const parsed = (() => {
    try {
      return { ok: true as const, value: JSON.parse(content) as unknown };
    } catch {
      return { ok: false as const };
    }
  })();
  const keyValid = CONFIG_KEY_PATTERN.test(key.trim());
  const create = useMutation({
    mutationFn: () => createConfigDocument(resource, { key: key.trim(), name: { [DEFAULT_LOCALE]: name.trim() }, description: description.trim() ? { [DEFAULT_LOCALE]: description.trim() } : undefined, content: parsed.ok ? parsed.value : {} }),
    meta: { handlesError: true },
    onSuccess: (document) => {
      toast.success(t('created'));
      void queryClient.invalidateQueries({ queryKey: adminConfigKeys.all });
      router.push(`${configDocumentHref(resource, document.id)}?v=1`);
    },
    onError: (failure) => setError(errorText(failure)),
  });
  return (
    <DetailSheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={t('createTitle')}
      description={t('createBody')}
      footer={
        <Button size="sm" disabled={!keyValid || name.trim().length < 2 || !parsed.ok || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Spinner /> : null}
          {t('create')}
        </Button>
      }
    >
      <Field data-invalid={key !== '' && !keyValid}>
        <FieldLabel htmlFor="config-key">{t('key')}</FieldLabel>
        <Input id="config-key" value={key} autoComplete="off" onChange={(event) => setKey(event.target.value)} />
        <FieldDescription>{t('keyHint')}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="config-name">{t('name')}</FieldLabel>
        <Input id="config-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="config-description">{t('descriptionLabel')}</FieldLabel>
        <Input id="config-description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field data-invalid={!parsed.ok}>
        <FieldLabel htmlFor="config-content">{t('content')}</FieldLabel>
        <Textarea id="config-content" rows={12} value={content} onChange={(event) => setContent(event.target.value)} className="font-mono text-xs" spellCheck={false} />
        {parsed.ok ? <FieldDescription>{t('contentHint')}</FieldDescription> : <FieldError>{t('jsonInvalid')}</FieldError>}
      </Field>
      {error ? (
        <p className="rounded-sm bg-error-soft px-3 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </DetailSheet>
  );
}

export function ConfigDocuments({ resource, tabs }: { resource: ConfigResource; tabs?: ReactNode }) {
  const t = useTranslations(`admin.configResources.${resource}`);
  const tConfig = useTranslations('admin.config');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const [status, setStatus] = useState<string>(CatalogStatus.Active);
  const [creating, setCreating] = useState(false);
  const documents = useInfiniteQuery(configDocumentsQuery(resource, anyToUndefined(status)));
  const title = (row: ConfigDocument) => (
    <Link href={configDocumentHref(resource, row.id)} className="flex min-w-0 flex-col hover:underline">
      <span className="truncate font-semibold text-navy">{pickText(row.name, locale) || row.key}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">{row.key}</span>
    </Link>
  );
  const columns: Column<ConfigDocument>[] = [
    { key: 'name', header: tConfig('name'), cell: title, hideOnCard: true },
    { key: 'active', header: tConfig('live'), cell: (row) => (row.activeVersion ? tConfig('versionNumber', { number: row.activeVersion.number }) : '—') },
    { key: 'open', header: tConfig('open'), cell: (row) => (row.openVersion ? <StatusBadge status={row.openVersion.status} tone={toneOf(REVIEW_STATUS_TONE, row.openVersion.status)} namespace="enums.configStatus" /> : '—') },
    { key: 'versions', header: tConfig('versions'), cell: (row) => <span className="tabular">{row.versions.length}</span> },
    { key: 'status', header: tConfig('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} /> },
    { key: 'updated', header: tConfig('updated'), cell: (row) => <span className="text-muted-foreground">{formatDate(row.updatedAt, locale)}</span>, className: 'hidden xl:table-cell' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={tConfig('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Icon name="add" size={16} />
            {tConfig('new')}
          </Button>
        }
      />
      {tabs}
      <FilterBar onRefresh={() => void documents.refetch()} refreshing={documents.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={CATALOG_STATUSES} label={tConfig('status')} allLabel={tConfig('anyStatus')} labelOf={(value) => enumLabel('catalogStatus', value)} />
      </FilterBar>
      <PagedList result={documents} columns={columns} rowKey={(row) => row.id} title={title} empty={<EmptyState icon="database" title={tConfig('emptyTitle')} body={tConfig('emptyBody')} />} />
      {creating ? <CreateSheet resource={resource} onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
