'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { ACTIVITY_BODY_MAX_LENGTH, ACTIVITY_OUTCOMES, ACTIVITY_TYPES, ActivityType } from '@/lib/constants/ops.constants';

export type ActivityInput = { type: string; outcome?: string; body?: string };

export function ActivityForm({ log, onLogged }: { log: (input: ActivityInput) => Promise<unknown>; onLogged: () => void }) {
  const t = useTranslations('leadWork');
  const typeLabel = useEnumLabel('activityType');
  const outcomeLabel = useEnumLabel('activityOutcome');
  const errorToast = useErrorToast();
  const bodyId = useId();
  const [type, setType] = useState<string>(ActivityType.Call);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const save = useMutation({
    mutationFn: () => log({ type, outcome: type === ActivityType.Call && outcome ? outcome : undefined, body: body.trim() || undefined }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('activityLogged'));
      setBody('');
      setOutcome(null);
      onLogged();
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-subtle/60 p-3">
      <ChipGroup label={t('activityType')}>
        {ACTIVITY_TYPES.map((value) => (
          <ChoiceChip key={value} selected={type === value} label={typeLabel(value)} onToggle={() => setType(value)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      {type === ActivityType.Call ? (
        <ChipGroup label={t('outcome')}>
          {ACTIVITY_OUTCOMES.map((value) => (
            <ChoiceChip key={value} selected={outcome === value} label={outcomeLabel(value)} onToggle={() => setOutcome(value)} className="min-h-8 text-xs" />
          ))}
        </ChipGroup>
      ) : null}
      <Field>
        <FieldLabel htmlFor={bodyId}>{t('activityNote')}</FieldLabel>
        <Textarea id={bodyId} rows={2} value={body} maxLength={ACTIVITY_BODY_MAX_LENGTH} onChange={(event) => setBody(event.target.value)} />
      </Field>
      <Button size="sm" className="self-start" onClick={() => save.mutate()} disabled={save.isPending || (type === ActivityType.Note && body.trim().length === 0)}>
        {t('logActivity')}
      </Button>
    </div>
  );
}
