'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DocumentSlotCard, type UploadState } from '@/components/borrower/document-slot-card';
import { JourneyFooter } from '@/components/journey/journey-footer';
import { JourneyPage } from '@/components/journey/journey-page';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { applicationKeys } from '@/lib/api/applications';
import { requestAnalysis } from '@/lib/api/assessments';
import { applicationDocumentsQuery, documentChecklistQuery, documentDownloadUrl, documentRequestsQuery, removeDocument, uploadDocument } from '@/lib/api/documents';
import type { ChecklistItem, DocumentChecklist, DocumentRequest, DocumentView } from '@/lib/api/types/document.types';
import { ANALYSIS_RUN_PARAM } from '@/lib/constants/assessment.constants';
import { DOCUMENT_POLL_MS, DocumentRequestStatus, DocumentStatus, MIME_LABELS, PROCESSING_DOCUMENT_STATUSES } from '@/lib/constants/document.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import { JOURNEY_SCREEN_STEP, JourneyScreen } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { formatDate } from '@/lib/format/date';
import { formatSizeLimit } from '@/lib/format/file-size';

const isProcessing = (checklist: DocumentChecklist | undefined) => Boolean(checklist?.items.some((item) => item.documents.some((document) => PROCESSING_DOCUMENT_STATUSES.includes(document.status))));

const latestRejected = (item: ChecklistItem, documents: DocumentView[]) => {
  const keys = new Set(item.documentTypes.map((type) => type.key));
  const newestHeld = item.documents.reduce((latest, document) => (document.createdAt > latest ? document.createdAt : latest), '');
  return documents.filter((document) => keys.has(document.documentType.key) && document.status === DocumentStatus.Rejected && document.createdAt > newestHeld).toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
};

const heldOf = (documents: DocumentView[], key: string) =>
  documents
    .filter((document) => document.documentType.key === key && (PROCESSING_DOCUMENT_STATUSES.includes(document.status) || document.status === DocumentStatus.Verified || document.status === DocumentStatus.NeedsReview))
    .map((document) => ({ id: document.id, documentType: key, status: document.status, fileName: document.fileName, applicationId: document.applicationId, createdAt: document.createdAt }));

const requestedItems = (checklist: DocumentChecklist, requests: DocumentRequest[], documents: DocumentView[]): ChecklistItem[] => {
  const known = new Set(checklist.items.flatMap((item) => item.documentTypes.map((type) => type.key)));
  const mimes = [...new Set(checklist.items.flatMap((item) => item.documentTypes.flatMap((type) => type.acceptedMimeTypes)))];
  const maxSize = Math.max(0, ...checklist.items.flatMap((item) => item.documentTypes.map((type) => type.maxSizeBytes)));
  return requests
    .flatMap((request) => request.documentTypes)
    .filter((type, index, all) => !known.has(type.key) && all.findIndex((other) => other.key === type.key) === index)
    .map((type) => {
      const held = heldOf(documents, type.key);
      return {
        key: type.key,
        label: type.label,
        description: null,
        required: true,
        minCount: 1,
        anyOf: false,
        conditional: true,
        documentTypes: [{ key: type.key, label: type.label, description: null, icon: null, acceptedMimeTypes: mimes, maxSizeBytes: maxSize, periodRule: null }],
        neededBy: [],
        satisfied: held.length > 0,
        documents: held,
      };
    });
};

const acceptedLabel = (checklist: DocumentChecklist) => {
  const types = checklist.items.flatMap((item) => item.documentTypes);
  const labels = [...new Set(types.flatMap((type) => type.acceptedMimeTypes.map((mime) => MIME_LABELS[mime] ?? mime)))];
  const limit = Math.max(0, ...types.map((type) => type.maxSizeBytes));
  return { formats: labels.join(' · '), limit: formatSizeLimit(limit) };
};

function DocumentsForm({ applicationId, checklist, documents, requests }: { applicationId: string; checklist: DocumentChecklist; documents: DocumentView[]; requests: DocumentRequest[] }) {
  const t = useTranslations('flow.documents');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const errorToast = useErrorToast();
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllers = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const running = controllers.current;
    return () => running.forEach((controller) => controller.abort());
  }, []);
  const openRequests = requests.filter((request) => request.status === DocumentRequestStatus.Open);
  const requestedKeys = new Set(openRequests.flatMap((request) => request.documentTypes.map((type) => type.key)));
  const extra = requestedItems(checklist, openRequests, documents);
  const items = [...extra, ...checklist.items];
  const required = items.filter((item) => item.required && !item.conditional);
  const optional = items.filter((item) => !item.required || item.conditional);
  const ready = required.filter((item) => item.satisfied).length;
  const uploading = Object.values(uploads).some((upload) => upload.phase === 'uploading');
  const processing = isProcessing(checklist);
  const missing = required.filter((item) => !item.satisfied);
  const accepted = acceptedLabel(checklist);
  const refresh = () => queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
  const setUpload = (key: string, state: UploadState | null) =>
    setUploads((current) => {
      const next = { ...current };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });
  const start = async (item: ChecklistItem, input: { file: File; documentType: string; password?: string }) => {
    const controller = new AbortController();
    controllers.current.set(item.key, controller);
    setError(null);
    setUpload(item.key, { phase: 'uploading', fileName: input.file.name, progress: 0 });
    try {
      await uploadDocument(
        { ...input, applicationId },
        {
          signal: controller.signal,
          onProgress: (progress) => setUploads((current) => (current[item.key]?.phase === 'uploading' ? { ...current, [item.key]: { phase: 'uploading', fileName: input.file.name, progress } } : current)),
        },
      );
      setUpload(item.key, null);
      toast.success(t('uploaded', { name: item.label }));
      await refresh();
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') setUpload(item.key, null);
      else setUpload(item.key, { phase: 'failed', message: errorText(failure) });
    } finally {
      if (controllers.current.get(item.key) === controller) controllers.current.delete(item.key);
    }
  };
  const remove = useMutation({
    mutationFn: (documentId: string) => removeDocument(documentId),
    meta: { handlesError: true },
    onMutate: (documentId) => setRemovingId(documentId),
    onSuccess: () => {
      toast.success(t('removed'));
      void refresh();
    },
    onError: (failure) => errorToast(failure),
    onSettled: () => setRemovingId(null),
  });
  const view = async (documentId: string) => {
    const tab = window.open('', '_blank');
    try {
      const { url } = await documentDownloadUrl(documentId);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else window.location.assign(url);
    } catch (failure) {
      tab?.close();
      errorToast(failure);
    }
  };
  const analyse = useMutation({
    mutationFn: () => requestAnalysis(applicationId),
    meta: { handlesError: true },
    onSuccess: (analysis) => {
      void refresh();
      router.push(`${RoutePath.applicationStep(applicationId, JourneyScreen.Analysis)}?${ANALYSIS_RUN_PARAM}=${analysis.id}`);
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === ErrorCode.ConsentRequired) {
        setError(t('consentNeeded'));
        router.push(RoutePath.applicationStep(applicationId, JourneyScreen.Consents));
        return;
      }
      setError(errorText(failure));
    },
  });
  const hint = uploading || processing ? t('stillChecking') : missing.length > 0 ? t('addToContinue', { names: missing.map((item) => item.label).join(', ') }) : null;
  const card = (item: ChecklistItem, index: number) => (
    <motion.div key={item.key} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }}>
      <DocumentSlotCard
        item={item}
        rejected={latestRejected(item, documents)}
        upload={uploads[item.key]}
        requested={item.documentTypes.filter((type) => requestedKeys.has(type.key)).map((type) => type.key)}
        locked={analyse.isPending}
        removingId={removingId}
        onUpload={(input) => void start(item, input)}
        onCancel={() => controllers.current.get(item.key)?.abort()}
        onRemove={(documentId) => remove.mutate(documentId)}
        onView={(documentId) => void view(documentId)}
      />
    </motion.div>
  );
  return (
    <JourneyPage applicationId={applicationId} step={JOURNEY_SCREEN_STEP[JourneyScreen.Documents]} title={t('title', { count: required.length })} description={t('description')}>
      <div className="flex flex-col gap-4">
        {required.length > 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-card" aria-label={t('readyLabel', { ready, total: required.length })}>
            <ProgressRing progress={required.length ? ready / required.length : 0} size={56} stroke={5}>
              <span className="font-heading text-sm font-semibold text-navy tabular">
                {ready}/{required.length}
              </span>
            </ProgressRing>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-navy">{ready === required.length ? t('allReady') : t('ready')}</span>
              <span className="text-xs text-muted-foreground">{t('takesMinutes')}</span>
            </div>
          </div>
        ) : null}
        {openRequests.length > 0 ? (
          <section className="flex items-start gap-3 rounded-xl bg-gold-soft p-3.5" aria-live="polite">
            <IconTile icon="error" tone="gold" className="size-9 rounded-[10px]" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm font-semibold text-navy">{t('lenderAsked', { count: openRequests.reduce((sum, request) => sum + request.documentTypes.length, 0) })}</p>
              {openRequests.map((request) => (
                <div key={request.id} className="flex flex-col gap-0.5 text-[13px]">
                  <span className="text-foreground">{request.documentTypes.map((type) => type.label).join(', ')}</span>
                  {request.note ? <span className="text-xs text-muted-foreground">{request.note}</span> : null}
                  {request.dueAt ? <span className="text-xs font-semibold text-gold-deep">{t('dueBy', { date: formatDate(request.dueAt, locale) })}</span> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <div className="flex flex-col gap-3.5">{required.map(card)}</div>
        {optional.length > 0 ? (
          <>
            <h2 className="px-1 text-xs font-semibold tracking-[0.04em] text-muted-foreground">{t('optionalSection')}</h2>
            <div className="flex flex-col gap-3.5">{optional.map((item, index) => card(item, required.length + index))}</div>
          </>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">{t('formats', accepted)}</p>
        <section className="flex flex-col gap-2 rounded-xl bg-subtle p-4">
          <h2 className="flex items-center gap-2 font-heading text-[17px] font-semibold text-navy">
            <Icon name="info" size={18} />
            {t('whyTitle', { count: required.length })}
          </h2>
          <p className="text-sm/[22px] text-muted-foreground">{t('whyBody')}</p>
        </section>
      </div>
      <div className="min-h-4 flex-1" />
      <JourneyFooter label={t('getScore')} onContinue={() => analyse.mutate()} disabled={missing.length > 0 || uploading || processing} pending={analyse.isPending} hint={hint} error={error} note={t('private')} />
    </JourneyPage>
  );
}

export function DocumentsScreen() {
  const t = useTranslations('flow.documents');
  const { id } = useParams<{ id: string }>();
  const checklist = useQuery({ ...documentChecklistQuery(id), refetchInterval: (query) => (isProcessing(query.state.data) ? DOCUMENT_POLL_MS : false) });
  const documents = useQuery(applicationDocumentsQuery(id));
  const requests = useQuery(documentRequestsQuery(id));
  if (checklist.isPending) return <ScreenSkeleton />;
  if (!checklist.data) return <p className="mx-auto max-w-[560px] rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <DocumentsForm applicationId={id} checklist={checklist.data} documents={documents.data?.items ?? []} requests={requests.data?.items ?? []} />;
}
