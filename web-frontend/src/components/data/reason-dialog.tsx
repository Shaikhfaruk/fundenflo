'use client';

import { useId, useState } from 'react';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  hint?: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  minLength: number;
  maxLength: number;
  onConfirm: (reason: string) => void;
};

export function ReasonDialog({ open, onOpenChange, title, description, label, hint, confirmLabel, destructive, pending, minLength, maxLength, onConfirm }: Props) {
  const id = useId();
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= minLength;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      pending={pending}
      confirmDisabled={!valid}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Textarea id={id} value={reason} maxLength={maxLength} rows={3} onChange={(event) => setReason(event.target.value)} />
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      </Field>
    </ConfirmDialog>
  );
}
