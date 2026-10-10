'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';

import { Section } from '@/components/data/detail-section';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText } from '@/hooks/use-error-toast';
import { evaluateCondition, validateCondition } from '@/lib/api/admin';

const JSON_INDENT = 2;

const SAMPLE_CONDITION = { attr: 'business.gst_registered', op: 'eq', value: true };

const SAMPLE_FACTS = { 'business.gst_registered': true };

const parse = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
};

export function ConditionPlayground({ tabs }: { tabs: ReactNode }) {
  const t = useTranslations('admin.conditions');
  const errorText = useErrorText();
  const conditionId = useId();
  const factsId = useId();
  const [condition, setCondition] = useState(JSON.stringify(SAMPLE_CONDITION, null, JSON_INDENT));
  const [facts, setFacts] = useState(JSON.stringify(SAMPLE_FACTS, null, JSON_INDENT));
  const [result, setResult] = useState<string | null>(null);
  const parsedCondition = parse(condition);
  const parsedFacts = parse(facts);
  const show = (value: unknown) => setResult(JSON.stringify(value, null, JSON_INDENT));
  const validate = useMutation({ mutationFn: () => validateCondition(parsedCondition.ok ? parsedCondition.value : null), meta: { handlesError: true }, onSuccess: show, onError: (failure) => setResult(errorText(failure)) });
  const evaluate = useMutation({
    mutationFn: () => evaluateCondition({ condition: parsedCondition.ok ? parsedCondition.value : null, facts: parsedFacts.ok ? (parsedFacts.value as Record<string, unknown>) : undefined }),
    meta: { handlesError: true },
    onSuccess: show,
    onError: (failure) => setResult(errorText(failure)),
  });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      {tabs}
      <Section title={t('try')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Field data-invalid={!parsedCondition.ok}>
            <FieldLabel htmlFor={conditionId}>{t('condition')}</FieldLabel>
            <Textarea id={conditionId} rows={8} value={condition} onChange={(event) => setCondition(event.target.value)} className="font-mono text-xs" spellCheck={false} />
            {parsedCondition.ok ? <FieldDescription>{t('conditionHint')}</FieldDescription> : <FieldError>{t('jsonInvalid')}</FieldError>}
          </Field>
          <Field data-invalid={!parsedFacts.ok}>
            <FieldLabel htmlFor={factsId}>{t('facts')}</FieldLabel>
            <Textarea id={factsId} rows={8} value={facts} onChange={(event) => setFacts(event.target.value)} className="font-mono text-xs" spellCheck={false} />
            {parsedFacts.ok ? <FieldDescription>{t('factsHint')}</FieldDescription> : <FieldError>{t('jsonInvalid')}</FieldError>}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!parsedCondition.ok || validate.isPending} onClick={() => validate.mutate()}>
            {validate.isPending ? <Spinner /> : null}
            {t('validate')}
          </Button>
          <Button size="sm" disabled={!parsedCondition.ok || !parsedFacts.ok || evaluate.isPending} onClick={() => evaluate.mutate()}>
            {evaluate.isPending ? <Spinner /> : null}
            {t('evaluate')}
          </Button>
        </div>
        {result ? <pre className="max-h-80 overflow-auto rounded-lg bg-subtle p-3 font-mono text-xs text-navy">{result}</pre> : null}
      </Section>
    </div>
  );
}
