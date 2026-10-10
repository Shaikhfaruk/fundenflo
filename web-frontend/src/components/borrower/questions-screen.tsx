'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { type CityChoice, CityPicker } from '@/components/journey/city-picker';
import { JourneyFooter } from '@/components/journey/journey-footer';
import { JourneyPage } from '@/components/journey/journey-page';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { ChoiceChip } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { applicationKeys } from '@/lib/api/applications';
import { questionsQuery, submitAnswers } from '@/lib/api/journey';
import type { ApplicationQuestions, ResolvedQuestion } from '@/lib/api/types/question.types';
import { HIDDEN_VISIBILITY, JOURNEY_SCREEN_STEP, JourneyScreen, QuestionKind, QuestionStage } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { pickText } from '@/lib/format/localised';
import { groupRupees, paiseFromRupees, rupeesFromPaiseValue } from '@/lib/format/money';
import { cn } from '@/lib/utils';

type Values = Record<string, unknown>;

const DEFAULT_COLUMNS = 2;
const ANSWER_PATH = /^answers\.(\d+)\.value$/;
const COLUMN_CLASS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

const isAnswered = (value: unknown) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);

function QuestionInput({ item, value, onChange, cityLabel, onPickCity }: { item: ResolvedQuestion; value: unknown; onChange: (value: unknown) => void; cityLabel?: string; onPickCity: () => void }) {
  const t = useTranslations('flow.questions');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { question } = item;
  const columns = COLUMN_CLASS[question.ui?.columns ?? DEFAULT_COLUMNS] ?? COLUMN_CLASS[DEFAULT_COLUMNS];
  switch (question.kind) {
    case QuestionKind.SingleSelect:
      return (
        <div className={cn('grid gap-2', columns)}>
          {question.options?.map((option) => (
            <ChoiceChip key={option.value} selected={value === option.value} label={pickText(option.label, locale)} onToggle={() => onChange(option.value)} className="justify-center" />
          ))}
        </div>
      );
    case QuestionKind.MultiSelect: {
      const chosen = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={cn('grid gap-2', columns)}>
          {question.options?.map((option) => (
            <ChoiceChip
              key={option.value}
              selected={chosen.includes(option.value)}
              label={pickText(option.label, locale)}
              onToggle={() => onChange(chosen.includes(option.value) ? chosen.filter((entry) => entry !== option.value) : [...chosen, option.value])}
              className="justify-center"
            />
          ))}
        </div>
      );
    }
    case QuestionKind.Boolean:
      return (
        <div className="grid grid-cols-2 gap-2">
          <ChoiceChip selected={value === true} label={tCommon('yes')} onToggle={() => onChange(true)} className="justify-center" />
          <ChoiceChip selected={value === false} label={tCommon('no')} onToggle={() => onChange(false)} className="justify-center" />
        </div>
      );
    case QuestionKind.Money:
      return (
        <label className="flex h-[54px] items-center gap-1 rounded-lg border-2 border-transparent bg-field px-4 focus-within:border-navy focus-within:bg-card">
          <span className="font-heading text-lg font-semibold text-navy">₹</span>
          <input
            inputMode="numeric"
            aria-label={pickText(question.label, locale)}
            value={typeof value === 'number' ? groupRupees(rupeesFromPaiseValue(value)) : ''}
            onChange={(event) => {
              const digits = event.target.value.replaceAll(/\D/g, '');
              onChange(digits ? paiseFromRupees(Number(digits)) : undefined);
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground tabular outline-none"
          />
        </label>
      );
    case QuestionKind.Number:
      return <Input type="number" inputMode="decimal" aria-label={pickText(question.label, locale)} value={typeof value === 'number' ? String(value) : ''} onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))} />;
    case QuestionKind.Date:
      return <Input type="date" aria-label={pickText(question.label, locale)} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value || undefined)} />;
    case QuestionKind.Pincode:
      return <Input inputMode="numeric" maxLength={6} aria-label={pickText(question.label, locale)} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value.replaceAll(/\D/g, '') || undefined)} />;
    case QuestionKind.City:
      return (
        <button type="button" onClick={onPickCity} className="flex h-[54px] w-full items-center gap-3 rounded-lg bg-field px-3.5 text-left hover:bg-[#eceff3]">
          <Icon name="location" size={20} className={isAnswered(value) ? 'text-navy' : 'text-slate'} />
          <span className={cn('min-w-0 flex-1 truncate text-[15px] font-medium', !isAnswered(value) && 'text-muted-foreground')}>{cityLabel ?? (isAnswered(value) ? t('citySaved') : t('selectCity'))}</span>
        </button>
      );
    default:
      return <Textarea aria-label={pickText(question.label, locale)} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} rows={3} />;
  }
}

function QuestionsForm({ applicationId, data }: { applicationId: string; data: ApplicationQuestions }) {
  const t = useTranslations('flow.questions');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [values, setValues] = useState<Values>(() => Object.fromEntries(data.answers.map((answer) => [answer.questionKey, answer.value])));
  const [cityLabels, setCityLabels] = useState<Record<string, string>>({});
  const [cityFor, setCityFor] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const visible = data.questions.filter((item) => item.visibility !== HIDDEN_VISIBILITY && !data.hidden.includes(item.question.key));
  const remaining = visible.filter((item) => item.required && !isAnswered(values[item.question.key])).length;

  const save = useMutation({
    mutationFn: (answers: Array<{ questionKey: string; value: unknown }>) => submitAnswers(applicationId, QuestionStage.PreCheck, answers),
    meta: { handlesError: true },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all, refetchType: 'inactive' });
      if (result.remaining.length === 0) router.push(RoutePath.applicationStep(applicationId, JourneyScreen.People));
    },
    onError: (failure, answers) => {
      if (failure instanceof ApiError && failure.fieldIssues.length > 0) {
        const mapped: Record<string, string> = {};
        for (const issue of failure.fieldIssues) {
          const index = ANSWER_PATH.exec(issue.path)?.[1];
          const key = index === undefined ? undefined : answers[Number(index)]?.questionKey;
          if (key) mapped[key] = issue.message;
        }
        setIssues(mapped);
      }
      setError(errorText(failure));
    },
  });

  const submit = () => {
    setIssues({});
    setError(null);
    save.mutate(visible.filter((item) => isAnswered(values[item.question.key])).map((item) => ({ questionKey: item.question.key, value: values[item.question.key] })));
  };

  return (
    <JourneyPage applicationId={applicationId} step={JOURNEY_SCREEN_STEP[JourneyScreen.Questions]} eyebrow={t('eyebrow')} title={t('title')} description={t('description', { count: visible.length })}>
      <div className="flex flex-col gap-3">
        {visible.map((item, index) => (
          <motion.section key={item.question.key} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }} className="rounded-xl bg-card p-4 shadow-card">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">{pickText(item.question.label, locale)}</h2>
              <span className="shrink-0 text-xs text-muted-foreground tabular">{t('count', { current: index + 1, total: visible.length })}</span>
            </div>
            {item.question.help ? <p className="-mt-2 mb-3 text-xs text-muted-foreground">{pickText(item.question.help, locale)}</p> : null}
            <QuestionInput
              item={item}
              value={values[item.question.key]}
              onChange={(next) => setValues((current) => ({ ...current, [item.question.key]: next }))}
              cityLabel={cityLabels[item.question.key]}
              onPickCity={() => setCityFor(item.question.key)}
            />
            {issues[item.question.key] ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <Icon name="error" size={14} />
                {issues[item.question.key]}
              </p>
            ) : null}
          </motion.section>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-subtle px-3 py-3 text-xs/[18px] text-muted-foreground">
        <Icon name="shield-person" size={18} className="shrink-0 text-navy" />
        {t('note')}
      </p>
      <div className="min-h-4 flex-1" />
      <JourneyFooter label={t('continue')} onContinue={submit} disabled={remaining > 0} pending={save.isPending} hint={t('hint', { count: remaining })} error={error} note={t('secure')} />
      <CityPicker
        open={cityFor !== null}
        onOpenChange={(open) => {
          if (!open) setCityFor(null);
        }}
        title={t('selectCity')}
        allowCustom={false}
        onSelect={(choice: CityChoice) => {
          if (!cityFor || !choice.cityId) return;
          setValues((current) => ({ ...current, [cityFor]: choice.cityId }));
          setCityLabels((current) => ({ ...current, [cityFor]: choice.label }));
        }}
      />
    </JourneyPage>
  );
}

export function QuestionsScreen() {
  const { id } = useParams<{ id: string }>();
  const questions = useQuery(questionsQuery(id, QuestionStage.PreCheck));
  if (!questions.data) return <ScreenSkeleton />;
  return <QuestionsForm key={id} applicationId={id} data={questions.data} />;
}
