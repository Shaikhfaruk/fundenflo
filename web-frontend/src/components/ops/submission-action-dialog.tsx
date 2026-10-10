'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { uploadDocument } from '@/lib/api/documents';
import { SUBMISSION_NOTE_MAX_LENGTH, SUBMISSION_NOTE_MIN_LENGTH, SUBMISSION_REJECTION_REASONS, SubmissionAction } from '@/lib/constants/ops.constants';
import { paiseFromRupees } from '@/lib/format/money';

type Action = (typeof SubmissionAction)[keyof typeof SubmissionAction];

const NOTE_REQUIRED: readonly string[] = [SubmissionAction.RaiseQuery, SubmissionAction.Withdraw, SubmissionAction.Note];
const WITH_AMOUNT: readonly string[] = [SubmissionAction.Sanction, SubmissionAction.Disburse];
const WITH_REFERENCE: readonly string[] = [SubmissionAction.Acknowledge, SubmissionAction.Sanction];
const EVIDENCE_TYPE: Partial<Record<Action, string>> = { [SubmissionAction.Sanction]: 'sanction_letter', [SubmissionAction.Disburse]: 'disbursement_advice' };

type Props = {
  submissionId: string;
  action: Action | null;
  version: number;
  requireEvidence: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
};

export function SubmissionActionDialog({ submissionId, action, version, requireEvidence, onClose, onSubmit }: Props) {
  const t = useTranslations('ops.submissionActions');
  const reasonLabel = useEnumLabel('rejection');
  const errorText = useErrorText();
  const noteId = useId();
  const amountId = useId();
  const referenceId = useId();
  const fileId = useId();
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = action ?? SubmissionAction.Note;
  const evidenceType = EVIDENCE_TYPE[kind];
  const needsEvidence = requireEvidence && evidenceType !== undefined;
  const trimmed = note.trim();
  const rupees = Number(amount.replaceAll(',', ''));
  const noteOk = NOTE_REQUIRED.includes(kind) ? trimmed.length >= SUBMISSION_NOTE_MIN_LENGTH : trimmed.length === 0 || trimmed.length >= SUBMISSION_NOTE_MIN_LENGTH;
  const amountOk = !WITH_AMOUNT.includes(kind) || (Number.isFinite(rupees) && rupees > 0);
  const valid = noteOk && amountOk && (kind !== SubmissionAction.Reject || reason !== null) && (!needsEvidence || file !== null);
  const submit = useMutation({
    mutationFn: async () => {
      const evidence = needsEvidence && file && evidenceType ? await uploadDocument({ file, documentType: evidenceType, submissionId }) : null;
      return onSubmit({
        action: kind,
        expectedVersion: version,
        ...(trimmed ? { note: trimmed } : {}),
        ...(WITH_AMOUNT.includes(kind) ? { amountPaise: paiseFromRupees(rupees) } : {}),
        ...(WITH_REFERENCE.includes(kind) && reference.trim() ? { lenderReference: reference.trim() } : {}),
        ...(kind === SubmissionAction.Reject && reason ? { reason } : {}),
        ...(evidence ? { evidenceDocumentId: evidence.id } : {}),
      });
    },
    meta: { handlesError: true },
    onSuccess: onClose,
    onError: (failure) => setError(errorText(failure)),
  });
  return (
    <ConfirmDialog open={action !== null} onOpenChange={(open) => (open ? null : onClose())} title={t(`${kind}.title`)} description={t(`${kind}.body`)} confirmLabel={t(`${kind}.confirm`)} destructive={kind === SubmissionAction.Reject || kind === SubmissionAction.Withdraw} pending={submit.isPending} confirmDisabled={!valid} onConfirm={() => submit.mutate()}>
      {kind === SubmissionAction.Reject ? (
        <ChipGroup label={t('reason')} showLabel>
          {SUBMISSION_REJECTION_REASONS.map((value) => (
            <ChoiceChip key={value} selected={reason === value} label={reasonLabel(value)} onToggle={() => setReason(value)} className="min-h-9 text-[13px]" />
          ))}
        </ChipGroup>
      ) : null}
      {WITH_AMOUNT.includes(kind) ? (
        <Field>
          <FieldLabel htmlFor={amountId}>{t('amount')}</FieldLabel>
          <Input id={amountId} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="tabular" />
        </Field>
      ) : null}
      {WITH_REFERENCE.includes(kind) ? (
        <Field>
          <FieldLabel htmlFor={referenceId}>{t('reference')}</FieldLabel>
          <Input id={referenceId} value={reference} maxLength={100} onChange={(event) => setReference(event.target.value)} />
        </Field>
      ) : null}
      {needsEvidence ? (
        <Field>
          <FieldLabel htmlFor={fileId}>{t('evidence')}</FieldLabel>
          <Input id={fileId} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <FieldDescription>{t('evidenceHint')}</FieldDescription>
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor={noteId}>{NOTE_REQUIRED.includes(kind) ? t('note') : t('noteOptional')}</FieldLabel>
        <Textarea id={noteId} rows={3} value={note} maxLength={SUBMISSION_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    </ConfirmDialog>
  );
}
