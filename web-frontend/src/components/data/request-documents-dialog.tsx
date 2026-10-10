'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useErrorToast } from '@/hooks/use-error-toast';
import { DOCUMENT_REQUEST_DUE_DAYS, LEAD_NOTE_MAX_LENGTH, LEAD_NOTE_MIN_LENGTH } from '@/lib/constants/ops.constants';

type Body = { documentTypes: string[]; note?: string; dueInDays?: number };

type Props = { open: boolean; onOpenChange: (open: boolean) => void; types: Array<{ key: string; label: string }>; onSubmit: (body: Body) => Promise<unknown> };

export function RequestDocumentsDialog({ open, onOpenChange, types, onSubmit }: Props) {
  const t = useTranslations('documentRequest');
  const errorToast = useErrorToast();
  const noteId = useId();
  const daysId = useId();
  const [chosen, setChosen] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [days, setDays] = useState(String(DOCUMENT_REQUEST_DUE_DAYS));
  const request = useMutation({
    mutationFn: () => onSubmit({ documentTypes: chosen, note: note.trim() || undefined, dueInDays: Number(days) || undefined }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('requested'));
      setChosen([]);
      setNote('');
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  const toggle = (key: string) => setChosen((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('title')} description={t('body')} confirmLabel={t('send')} pending={request.isPending} confirmDisabled={chosen.length === 0 || (note.trim().length > 0 && note.trim().length < LEAD_NOTE_MIN_LENGTH)} onConfirm={() => request.mutate()}>
      <ChipGroup label={t('types')} showLabel>
        {types.map((type) => (
          <ChoiceChip key={type.key} selected={chosen.includes(type.key)} label={type.label} onToggle={() => toggle(type.key)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      <Field>
        <FieldLabel htmlFor={noteId}>{t('note')}</FieldLabel>
        <Textarea id={noteId} rows={2} value={note} maxLength={LEAD_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={daysId}>{t('dueInDays')}</FieldLabel>
        <Input id={daysId} inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value.replaceAll(/\D/g, '').slice(0, 2))} className="w-24 tabular" />
      </Field>
    </ConfirmDialog>
  );
}
