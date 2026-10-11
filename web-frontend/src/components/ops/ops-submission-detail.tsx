'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { KeyValues, Section } from '@/components/data/detail-section';
import { ReasonDialog } from '@/components/data/reason-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { SubmissionActionDialog } from '@/components/submissions/submission-action-dialog';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useErrorText } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { approveSubmission, opsCaseKeys, opsSubmissionQuery, recordSubmissionEvent } from '@/lib/api/ops-cases';
import type { OpsSubmissionDetail } from '@/lib/api/types/ops.types';
import { SUBMISSION_NOTE_MAX_LENGTH, SUBMISSION_NOTE_MIN_LENGTH, SubmissionAction } from '@/lib/constants/ops.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, SUBMISSION_STATUS_TONE, SubmissionStatus, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';

type Action = (typeof SubmissionAction)[keyof typeof SubmissionAction];

const ACTIONS_BY_STATUS: Record<string, Action[]> = {
  [SubmissionStatus.PendingApproval]: [SubmissionAction.Withdraw, SubmissionAction.Note],
  [SubmissionStatus.Approved]: [SubmissionAction.Withdraw, SubmissionAction.Note],
  [SubmissionStatus.SentToLender]: [SubmissionAction.Acknowledge, SubmissionAction.RaiseQuery, SubmissionAction.Reject, SubmissionAction.Withdraw, SubmissionAction.Note],
  [SubmissionStatus.UnderReview]: [SubmissionAction.Sanction, SubmissionAction.RaiseQuery, SubmissionAction.Reject, SubmissionAction.Withdraw, SubmissionAction.Note],
  [SubmissionStatus.QueryRaised]: [SubmissionAction.AnswerQuery, SubmissionAction.Reject, SubmissionAction.Withdraw, SubmissionAction.Note],
  [SubmissionStatus.Sanctioned]: [SubmissionAction.Disburse, SubmissionAction.Withdraw, SubmissionAction.Note],
  [SubmissionStatus.Disbursed]: [SubmissionAction.Disburse, SubmissionAction.Note],
};

const PRIMARY: readonly string[] = [SubmissionAction.Acknowledge, SubmissionAction.Sanction, SubmissionAction.AnswerQuery, SubmissionAction.Disburse];

function SubmissionView({ submission }: { submission: OpsSubmissionDetail }) {
  const t = useTranslations('ops.submissionDetail');
  const tActions = useTranslations('ops.submissionActions');
  const tStatus = useTranslations('status');
  const eventLabel = useEnumLabel('submissionEvent');
  const actorLabel = useEnumLabel('actorContext');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [action, setAction] = useState<Action | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: opsCaseKeys.all });
  const approve = useMutation({
    mutationFn: (note: string) => approveSubmission(submission.id, { note: note || undefined, expectedVersion: submission.version }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('approved'));
      setApproveOpen(false);
      void refresh();
    },
  });
  const actions = ACTIONS_BY_STATUS[submission.status] ?? [SubmissionAction.Note];
  const packet = submission.packet?.content;
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.OpsSubmissions} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={submission.ref}
        title={submission.lender.name ?? submission.product.name}
        description={submission.product.name}
        badge={<StatusBadge status={submission.status} tone={toneOf(SUBMISSION_STATUS_TONE, submission.status)} />}
        actions={
          <>
            {submission.status === SubmissionStatus.PendingApproval ? (
              <Button size="sm" onClick={() => setApproveOpen(true)}>
                <Icon name="task" size={16} />
                {t('approve')}
              </Button>
            ) : null}
            {actions.map((item) => (
              <Button key={item} size="sm" variant={PRIMARY.includes(item) ? 'default' : item === SubmissionAction.Reject || item === SubmissionAction.Withdraw ? 'destructive' : 'outline'} onClick={() => setAction(item)}>
                {tActions(`${item}.button`)}
              </Button>
            ))}
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('summary')}>
            <KeyValues
              columns={3}
              items={[
                { label: t('case'), value: <Link href={RoutePath.opsCase(submission.applicationId)} className="font-semibold text-gold-ink hover:underline">{t('openCase')}</Link> },
                { label: t('lenderReference'), value: submission.lenderReference ?? '—' },
                { label: t('requested'), value: formatDateTime(submission.createdAt, locale) },
                { label: t('approvedAt'), value: formatDateTime(submission.approvedAt, locale) },
                { label: t('sentAt'), value: formatDateTime(submission.sentAt, locale) },
                { label: t('sanctioned'), value: submission.sanction ? formatPaise(submission.sanction.amountPaise, locale) : '—' },
                { label: t('disbursed'), value: submission.disbursal.amountPaise > 0 ? formatPaise(submission.disbursal.amountPaise, locale) : '—' },
                { label: t('rejection'), value: submission.rejection?.label ?? '—' },
                { label: t('withdrawn'), value: submission.withdrawnReason ?? '—' },
              ]}
            />
          </Section>
          <Section title={t('history')} delay={0.06}>
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
                    <span className="text-xs text-muted-foreground">{t('eventLine', { actor: actorLabel(event.actorContext ?? event.actorType), when: formatRelative(event.createdAt, locale) })}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('packet')} delay={0.04}>
            {submission.packet ? (
              <KeyValues
                columns={1}
                items={[
                  { label: t('borrower'), value: packet?.borrower?.name ?? '—' },
                  { label: t('facts'), value: String(packet?.borrower?.facts?.length ?? 0) },
                  { label: t('documentCount'), value: String(packet?.documents?.length ?? 0) },
                  { label: t('builtAt'), value: formatDateTime(submission.packet.createdAt, locale) },
                  { label: t('hash'), value: <span className="font-mono text-xs break-all">{submission.packet.hash}</span> },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t('noPacket')}</p>
            )}
          </Section>
          <Section title={t('documentRequests')} delay={0.08}>
            {submission.documentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noRequests')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {submission.documentRequests.map((request) => (
                  <li key={request.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-foreground">{request.documentTypes.map((type) => type.label).join(', ')}</span>
                      {request.note ? <span className="text-xs text-muted-foreground">{request.note}</span> : null}
                    </span>
                    <StatusBadge status={request.status} tone={toneOf(REVIEW_STATUS_TONE, request.status)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
      <ReasonDialog
        open={approveOpen}
        onOpenChange={(open) => {
          setApproveOpen(open);
          if (!open) approve.reset();
        }}
        title={t('approveTitle')}
        description={t('approveBody')}
        label={t('approveNote')}
        confirmLabel={t('approve')}
        pending={approve.isPending}
        minLength={SUBMISSION_NOTE_MIN_LENGTH}
        maxLength={SUBMISSION_NOTE_MAX_LENGTH}
        noteOptional
        error={approve.error ? errorText(approve.error) : null}
        onConfirm={(note) => approve.mutate(note)}
      />
      {action ? (
        <SubmissionActionDialog
          key={action}
          submissionId={submission.id}
          action={action}
          version={submission.version}
          requireEvidence
          onClose={() => setAction(null)}
          onSubmit={async (body) => {
            await recordSubmissionEvent(submission.id, body);
            toast.success(t('recorded'));
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

export function OpsSubmissionDetail() {
  const t = useTranslations('ops.submissionDetail');
  const { id } = useParams<{ id: string }>();
  const submission = useQuery(opsSubmissionQuery(id));
  if (submission.isPending) return <ScreenSkeleton />;
  if (!submission.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <SubmissionView submission={submission.data} />;
}
