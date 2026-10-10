'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { KeyValues, Section } from '@/components/data/detail-section';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { FactValueInput } from '@/components/ops/fact-value-input';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { documentDownloadUrl } from '@/lib/api/documents';
import { attributesQuery, documentQuery, documentTypesQuery, extractionsQuery, opsCaseKeys, reviewDocument } from '@/lib/api/ops-cases';
import type { AttributeDefinition } from '@/lib/api/types/admin.types';
import type { DocumentView } from '@/lib/api/types/document.types';
import type { DocumentExtraction } from '@/lib/api/types/ops.types';
import { DocumentStatus } from '@/lib/constants/document.constants';
import { DOCUMENT_REJECT_REASONS, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH, ReviewOutcome } from '@/lib/constants/ops.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { DOCUMENT_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime } from '@/lib/format/date';
import { factInputOf, formatFactValue, parseFactInput } from '@/lib/format/fact';
import { formatFileSize } from '@/lib/format/file-size';
import { pickText } from '@/lib/format/localised';

const PERCENT = 100;

const REVIEWABLE: readonly string[] = [DocumentStatus.NeedsReview, DocumentStatus.Extracting];

function ReviewForm({ document, attributes, extraction }: { document: DocumentView; attributes: AttributeDefinition[]; extraction: DocumentExtraction | undefined }) {
  const t = useTranslations('ops.documentReview');
  const reasonLabel = useEnumLabel('documentReject');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(attributes.map((attribute) => [attribute.key, factInputOf(extraction?.fields.find((field) => field.attributeKey === attribute.key)?.value, attribute)])));
  const [rejectOpen, setRejectOpen] = useState(false);
  const parsed = attributes.map((attribute) => ({ attribute, raw: values[attribute.key] ?? '', result: parseFactInput(values[attribute.key] ?? '', attribute) }));
  const invalid = parsed.filter((item) => item.raw.trim() !== '' && !item.result.ok);
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: opsCaseKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['ops-parties'] });
  };
  const verify = useMutation({
    mutationFn: () => reviewDocument(document.id, { outcome: ReviewOutcome.Verified, fields: parsed.flatMap((item) => (item.result.ok ? [{ attributeKey: item.attribute.key, value: item.result.value }] : [])) }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('verified'));
      done();
    },
    onError: (failure) => errorToast(failure),
  });
  const reject = useMutation({
    mutationFn: ({ reason, note }: { reason: string; note: string }) => reviewDocument(document.id, { outcome: ReviewOutcome.Rejected, rejectReason: reason, note: note || undefined }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('rejected'));
      setRejectOpen(false);
      done();
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <Section title={t('values')} delay={0.06}>
      {attributes.length === 0 ? <p className="text-sm text-muted-foreground">{t('noFields')}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {parsed.map(({ attribute, raw, result }) => {
          const field = extraction?.fields.find((item) => item.attributeKey === attribute.key);
          const id = `field-${attribute.key}`;
          return (
            <Field key={attribute.key} data-invalid={raw.trim() !== '' && !result.ok}>
              <FieldLabel htmlFor={id}>{pickText(attribute.label, locale) || attribute.key}</FieldLabel>
              <FactValueInput id={id} attribute={attribute} value={raw} onChange={(next) => setValues((current) => ({ ...current, [attribute.key]: next }))} label={pickText(attribute.label, locale) || attribute.key} disabled={verify.isPending} />
              <FieldDescription>{field?.confidence !== null && field?.confidence !== undefined ? t('readWith', { percent: Math.round(field.confidence * PERCENT) }) : t('keyIn')}</FieldDescription>
            </Field>
          );
        })}
      </div>
      {invalid.length > 0 ? <p className="text-xs text-destructive">{t('fixValues')}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => verify.mutate()} disabled={verify.isPending || invalid.length > 0}>
          {verify.isPending ? <Spinner /> : <Icon name="verified" size={18} />}
          {t('verify')}
        </Button>
        <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={verify.isPending}>
          {t('reject')}
        </Button>
      </div>
      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t('rejectTitle')}
        description={t('rejectBody')}
        label={t('rejectNote')}
        confirmLabel={t('reject')}
        destructive
        pending={reject.isPending}
        minLength={LEAD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        noteOptional
        options={DOCUMENT_REJECT_REASONS.map((value) => ({ value, label: reasonLabel(value) }))}
        optionsLabel={t('rejectReason')}
        onConfirm={(note, reason) => reject.mutate({ reason: reason ?? 'other', note })}
      />
    </Section>
  );
}

export function OpsDocumentReview() {
  const t = useTranslations('ops.documentReview');
  const tCommon = useTranslations('common');
  const reasonLabel = useEnumLabel('documentReject');
  const locale = useLocale();
  const errorToast = useErrorToast();
  const { id } = useParams<{ id: string }>();
  const document = useQuery(documentQuery(id));
  const extractions = useQuery(extractionsQuery(id));
  const types = useQuery(documentTypesQuery());
  const attributes = useQuery(attributesQuery());
  if (document.isPending || extractions.isPending || types.isPending || attributes.isPending) return <ScreenSkeleton />;
  if (!document.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  const doc = document.data;
  const produced = types.data?.items.find((type) => type.key === doc.documentType.key)?.producesAttributes ?? [];
  const fields = produced.flatMap((key) => attributes.data?.items.find((attribute) => attribute.key === key) ?? []);
  const latest = extractions.data?.items[0];
  const open = async () => {
    const tab = window.open('', '_blank');
    try {
      const { url } = await documentDownloadUrl(doc.id);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else window.location.assign(url);
    } catch (failure) {
      tab?.close();
      errorToast(failure);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Link href={doc.applicationId ? RoutePath.opsCase(doc.applicationId) : AppPath.OpsCases} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {doc.applicationId ? t('backToCase') : t('backToCases')}
      </Link>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={pickText(doc.documentType.label, locale) || doc.documentType.key}
        badge={<StatusBadge status={doc.status} tone={toneOf(DOCUMENT_STATUS_TONE, doc.status)} />}
        actions={
          <Button variant="outline" size="sm" onClick={() => void open()}>
            <Icon name="visibility" size={16} />
            {t('openFile')}
          </Button>
        }
      />
      <Section title={t('file')}>
        <KeyValues
          columns={3}
          items={[
            { label: t('fileName'), value: doc.fileName },
            { label: t('size'), value: formatFileSize(doc.sizeBytes) },
            { label: t('uploaded'), value: formatDateTime(doc.createdAt, locale) },
            { label: t('password'), value: doc.passwordProtected ? tCommon('yes') : tCommon('no') },
            { label: t('reader'), value: latest ? t('readerLine', { extractor: latest.extractor, reason: latest.reason ?? '—' }) : '—' },
            { label: t('freshUntil'), value: formatDateTime(doc.freshUntil, locale) },
          ]}
        />
        {doc.rejectReason ? <p className="rounded-lg bg-error-soft p-3 text-sm text-destructive">{t('rejectedWith', { reason: reasonLabel(doc.rejectReason), note: doc.rejectNote ?? '' })}</p> : null}
      </Section>
      {REVIEWABLE.includes(doc.status) ? (
        <ReviewForm key={latest?.id ?? 'none'} document={doc} attributes={fields} extraction={latest} />
      ) : (
        <Section title={t('values')}>
          {latest && latest.fields.length > 0 ? (
            <KeyValues
              items={latest.fields.map((field) => {
                const attribute = attributes.data?.items.find((item) => item.key === field.attributeKey);
                return { label: pickText(attribute?.label, locale) || field.attributeKey, value: formatFactValue(field.value, attribute, locale, { yes: tCommon('yes'), no: tCommon('no') }) };
              })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('nothingToReview')}</p>
          )}
        </Section>
      )}
    </div>
  );
}
