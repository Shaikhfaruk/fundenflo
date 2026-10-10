'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useErrorToast } from '@/hooks/use-error-toast';
import { FOLLOW_UP_MAX_DAYS_AHEAD, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { DAY_MS, toLocalDateTime } from '@/lib/format/date';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; schedule: (input: { dueAt: string; note: string }) => Promise<unknown>; onScheduled: () => void };

export function FollowUpDialog({ open, onOpenChange, schedule, onScheduled }: Props) {
  const t = useTranslations('leadWork');
  const errorToast = useErrorToast();
  const dueId = useId();
  const noteId = useId();
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [now] = useState(() => Date.now());
  const dueAt = due ? new Date(due).getTime() : Number.NaN;
  const dueValid = Number.isFinite(dueAt) && dueAt > now && dueAt <= now + FOLLOW_UP_MAX_DAYS_AHEAD * DAY_MS;
  const save = useMutation({
    mutationFn: () => schedule({ dueAt: new Date(due).toISOString(), note: note.trim() }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('followUpScheduled'));
      setDue('');
      setNote('');
      onScheduled();
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('followUpTitle')} confirmLabel={t('schedule')} pending={save.isPending} confirmDisabled={!dueValid || note.trim().length < LEAD_NOTE_MIN_LENGTH} onConfirm={() => save.mutate()}>
      <Field>
        <FieldLabel htmlFor={dueId}>{t('dueAt')}</FieldLabel>
        <Input id={dueId} type="datetime-local" value={due} min={toLocalDateTime(now)} max={toLocalDateTime(now + FOLLOW_UP_MAX_DAYS_AHEAD * DAY_MS)} onChange={(event) => setDue(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={noteId}>{t('followUpNote')}</FieldLabel>
        <Textarea id={noteId} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}
