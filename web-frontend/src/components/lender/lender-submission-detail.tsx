'use client';

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { KeyValues, Section } from '@/components/data/detail-section';
import { RequestDocumentsDialog } from '@/components/data/request-documents-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { SubmissionActionDialog } from '@/components/submissions/submission-action-dialog';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { catalogChecklistQuery } from '@/lib/api/catalog';
import { lenderDocumentUrl, lenderKeys, lenderSubmissionQuery, recordLenderEvent, requestLenderDocuments } from '@/lib/api/lender';
import type { SubmissionFile } from '@/lib/api/types/submission.types';
import { CHECKLIST_STAGES, DOCUMENT_REQUEST_STATUSES, LENDER_ACTIONS_BY_STATUS, LENDER_PRIMARY_ACTIONS, LENDER_VIEWER_ROLE, type LenderAction } from '@/lib/constants/lender.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, SUBMISSION_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format/date';
import { attributeTitle, formatKeyedFact } from '@/lib/format/fact';
import { pickText } from '@/lib/format/localised';
import { formatPaise } from '@/lib/format/money';
import { useMe } from '@/lib/session/use-me';

function SubmissionView({ submission }: { submission: SubmissionFile }) {
  const t = useTranslations('lender.detail');
  const tActions = useTranslations('ops.submissionActions');
  const tStatus = useTranslations('status');
  const tCommon = useTranslations('common');
  const eventLabel = useEnumLabel('submissionEvent');
  const actorLabel = useEnumLabel('actorContext');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const { data: me } = useMe();
  const [action, setAction] = useState<LenderAction | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const packet = submission.packet?.content;
  const segment = packet?.application.segment ?? '';
  const checklists = useQueries({ queries: CHECKLIST_STAGES.map((stage) => ({ ...catalogChecklistQuery(stage, segment), enabled: requestOpen && Boolean(segment) })) });
  const types = [...new Map(checklists.flatMap((result) => result.data?.items ?? []).flatMap((item) => item.documentTypes).map((type) => [type.key, { key: type.key, label: type.label ?? type.key }])).values()];
  const canAct = me?.activeContext?.role !== LENDER_VIEWER_ROLE;
  const actions = canAct ? (LENDER_ACTIONS_BY_STATUS[submission.status] ?? []) : [];
  const yesNo = { yes: tCommon('yes'), no: tCommon('no') };
  const refresh = () => queryClient.invalidateQueries({ queryKey: lenderKeys.all });
  const open = async (documentId: string) => {
    const tab = window.open('', '_blank');
    try {
      const { url } = await lenderDocumentUrl(submission.id, documentId);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else window.location.assign(url);
    } catch (failure) {
      tab?.close();
      errorToast(failure);
    }
  };
  const facts = [...(packet?.borrower.facts ?? []), ...(packet?.applicant?.facts ?? [])];
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.LenderHome} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={submission.ref}
        title={packet?.borrower.name ?? submission.product.name}
        description={submission.product.name}
        badge={<StatusBadge status={submission.status} tone={toneOf(SUBMISSION_STATUS_TONE, submission.status)} />}
        actions={
          <>
            {actions.map((item) => (
              <Button key={item} size="sm" variant={LENDER_PRIMARY_ACTIONS.includes(item) ? 'default' : item === 'reject' ? 'destructive' : 'outline'} onClick={() => setAction(item)}>
                {tActions(`${item}.button`)}
              </Button>
            ))}
            {canAct && DOCUMENT_REQUEST_STATUSES.includes(submission.status) ? (
              <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
                <Icon name="document" size={16} />
                {t('askDocuments')}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('loan')}>
            <KeyValues
              columns={3}
              items={[
                { label: t('category'), value: categoryLabel(packet?.application.category ?? null) || '—' },
                { label: t('amount'), value: <span className="tabular">{formatPaise(packet?.application.amountPaise ?? null, locale)}</span> },
                { label: t('tenure'), value: packet?.application.tenureMonths ? t('months', { count: packet.application.tenureMonths }) : '—' },
                { label: t('purpose'), value: packet?.application.purposeNote ?? packet?.application.purpose ?? '—' },
                { label: t('received'), value: formatDateTime(submission.sentAt, locale) },
                { label: t('reference'), value: submission.lenderReference ?? '—' },
                { label: t('sanctioned'), value: submission.sanction ? formatPaise(submission.sanction.amountPaise, locale) : '—' },
                { label: t('disbursed'), value: submission.disbursal.amountPaise > 0 ? formatPaise(submission.disbursal.amountPaise, locale) : '—' },
                { label: t('rejection'), value: submission.rejection?.label ?? '—' },
              ]}
            />
          </Section>
          <Section title={t('facts')} delay={0.04}>
            {facts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noFacts')}</p>
            ) : (
              <ul className="flex flex-col">
                {facts.map((fact) => (
                  <li key={`${fact.attributeKey}-${fact.observedAt}`} className="flex flex-wrap items-center gap-2 border-t border-subtle py-2 first:border-t-0">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm text-foreground">{submission.attributeLabels[fact.attributeKey] ?? attributeTitle(fact.attributeKey)}</span>
                      <span className="text-xs text-muted-foreground">{t(`provenance.${fact.provenance}`)}</span>
                    </span>
                    <span className="text-sm font-semibold text-navy tabular">{formatKeyedFact(fact.attributeKey, fact.value, locale, yesNo)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t('history')} delay={0.08}>
            <ol className="flex flex-col">
              {submission.events.toReversed().map((event) => (
                <li key={event.id} className="flex items-start gap-3 border-t border-subtle py-2.5 first:border-t-0">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-navy" aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-foreground">
                      {eventLabel(event.type)}
                      {event.toStatus ? ` · ${tStatus.has(event.toStatus) ? tStatus(event.toStatus) : event.toStatus}` : ''}
                    </span>
                    {event.note ? <span className="text-[13px] text-muted-foreground">{event.note}</span> : null}
                    <span className="text-xs text-muted-foreground">{`${actorLabel(event.actorContext ?? event.actorType)} · ${formatRelative(event.createdAt, locale)}`}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('assessment')} delay={0.04}>
            {packet?.assessment ? (
              <div className="flex items-center gap-3">
                <span className="flex size-14 items-center justify-center rounded-full bg-navy font-heading text-xl font-semibold text-white tabular">{packet.assessment.value ?? '—'}</span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-navy">{pickText(packet.assessment.band, locale) || '—'}</span>
                  <span className="text-xs text-muted-foreground">{t('scoredOn', { date: formatDate(packet.assessment.computedAt, locale) })}</span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noScore')}</p>
            )}
            {packet?.match ? (
              <ul className="flex flex-col gap-1.5">
                {packet.match.reasons.map((reason) => (
                  <li key={pickText(reason, locale)} className="flex items-start gap-2 text-[13px] text-foreground">
                    <Icon name="check-circle" size={15} className="mt-0.5 text-success" />
                    {pickText(reason, locale)}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
          <Section title={t('documents')} delay={0.08}>
            {submission.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noDocuments')}</p>
            ) : (
              <ul className="flex flex-col">
                {submission.documents.map((document) => (
                  <li key={document.id} className="flex items-center gap-2 border-t border-subtle py-2 first:border-t-0">
                    <Icon name="document" size={16} className="text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">{pickText(document.documentType.label, locale) || document.documentType.key}</span>
                      <span className="truncate text-xs text-muted-foreground">{document.fileName}</span>
                    </span>
                    <Button size="icon-sm" variant="ghost" onClick={() => void open(document.id)} aria-label={t('openDocument', { name: document.fileName })}>
                      <Icon name="download" size={18} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t('requests')} delay={0.12}>
            {submission.documentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noRequests')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {submission.documentRequests.map((request) => (
                  <li key={request.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-foreground">{request.documentTypes.map((type) => type.label).join(', ')}</span>
                      {request.dueAt ? <span className="text-xs text-muted-foreground">{t('dueBy', { date: formatDate(request.dueAt, locale) })}</span> : null}
                    </span>
                    <StatusBadge status={request.status} tone={toneOf(REVIEW_STATUS_TONE, request.status)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
      {action ? (
        <SubmissionActionDialog
          key={action}
          submissionId={submission.id}
          action={action}
          version={submission.version}
          requireEvidence={false}
          onClose={() => setAction(null)}
          onSubmit={async (body) => {
            await recordLenderEvent(submission.id, body);
            toast.success(t('recorded'));
            await refresh();
          }}
        />
      ) : null}
      {requestOpen ? (
        <RequestDocumentsDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          types={types}
          onSubmit={async (body) => {
            await requestLenderDocuments(submission.id, body);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

export function LenderSubmissionDetail() {
  const t = useTranslations('lender.detail');
  const { id } = useParams<{ id: string }>();
  const submission = useQuery(lenderSubmissionQuery(id));
  if (submission.isPending) return <ScreenSkeleton />;
  if (!submission.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <SubmissionView submission={submission.data} />;
}
