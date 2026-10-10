'use client';

import { useId, useState } from 'react';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

type Option = { value: string; label: string };

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
  options?: Option[];
  optionsLabel?: string;
  noteOptional?: boolean;
  noteRequiredFor?: readonly string[];
  onConfirm: (reason: string, choice: string | null) => void;
};

export function ReasonDialog({ open, onOpenChange, title, description, label, hint, confirmLabel, destructive, pending, minLength, maxLength, options, optionsLabel, noteOptional, noteRequiredFor, onConfirm }: Props) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const trimmed = reason.trim();
  const noteNeeded = !noteOptional || (choice !== null && (noteRequiredFor?.includes(choice) ?? false));
  const noteValid = noteNeeded ? trimmed.length >= minLength : trimmed.length === 0 || trimmed.length >= minLength;
  const valid = noteValid && (!options || choice !== null);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setChoice(null);
        }
        onOpenChange(next);
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      pending={pending}
      confirmDisabled={!valid}
      onConfirm={() => onConfirm(trimmed, choice)}
    >
      {options ? (
        <ChipGroup label={optionsLabel ?? title} showLabel={Boolean(optionsLabel)}>
          {options.map((option) => (
            <ChoiceChip key={option.value} selected={choice === option.value} label={option.label} onToggle={() => setChoice(option.value)} className="min-h-9 text-[13px]" />
          ))}
        </ChipGroup>
      ) : null}
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Textarea id={id} value={reason} maxLength={maxLength} rows={3} onChange={(event) => setReason(event.target.value)} />
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      </Field>
    </ConfirmDialog>
  );
}
