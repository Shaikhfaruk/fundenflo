'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { EmptyState } from '@/components/data/empty-state';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { financeKeys, reconciliationRunsQuery, runReconciliation } from '@/lib/api/finance';
import type { ReconciliationRun } from '@/lib/api/types/finance.types';
import { RECONCILIATION_SOURCES } from '@/lib/constants/admin.constants';
import { formatDateTime } from '@/lib/format/date';
import { formatPaise } from '@/lib/format/money';
import { parseStatementLines } from '@/lib/format/statement-lines';

import { useLenderOptions } from './use-lender-options';

const ANY_LENDER = '__any__';

function RunDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('finance.reconciliation');
  const enumLabel = useEnumLabels();
  const lenders = useLenderOptions();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const linesId = useId();
  const [source, setSource] = useState<string>(RECONCILIATION_SOURCES[0]);
  const [lenderId, setLenderId] = useState(ANY_LENDER);
  const [text, setText] = useState('');
  const parsed = parseStatementLines(text);
  const run = useMutation({
    mutationFn: () => runReconciliation({ source, lenderId: lenderId === ANY_LENDER ? undefined : lenderId, lines: parsed.lines }),
    meta: { handlesError: true },
    onSuccess: (result) => {
      toast.success(t('done', { matched: result.matchedCount, total: result.lineCount }));
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('runTitle')} description={t('runBody')} confirmLabel={t('run')} pending={run.isPending} confirmDisabled={parsed.lines.length === 0 || parsed.bad.length > 0} onConfirm={() => run.mutate()}>
      <ChipGroup label={t('source')} showLabel>
        {RECONCILIATION_SOURCES.map((value) => (
          <ChoiceChip key={value} selected={source === value} label={enumLabel('reconciliationSource', value)} onToggle={() => setSource(value)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      <Field>
        <FieldLabel>{t('lender')}</FieldLabel>
        <Select value={lenderId} onValueChange={(value) => setLenderId(String(value))}>
          <SelectTrigger size="sm" className="h-11 w-full" aria-label={t('lender')}>
            <SelectValue>{(current: string | null) => (current && current !== ANY_LENDER ? (lenders.find((lender) => lender.id === current)?.name ?? current) : t('anyLender'))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_LENDER}>{t('anyLender')}</SelectItem>
            {lenders.map((lender) => (
              <SelectItem key={lender.id} value={lender.id}>
                {lender.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field data-invalid={parsed.bad.length > 0}>
        <FieldLabel htmlFor={linesId}>{t('lines')}</FieldLabel>
        <Textarea id={linesId} rows={6} value={text} onChange={(event) => setText(event.target.value)} className="font-mono text-xs" spellCheck={false} placeholder="RC-26-000008, 11800, NEFT1791661445, 2026-10-10" />
        {parsed.bad.length > 0 ? <FieldError>{t('badLines', { lines: parsed.bad.join(', ') })}</FieldError> : <FieldDescription>{t('linesHint', { count: parsed.lines.length })}</FieldDescription>}
      </Field>
    </ConfirmDialog>
  );
}

export function FinanceReconciliation() {
  const t = useTranslations('finance.reconciliation');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const runs = useInfiniteQuery(reconciliationRunsQuery());
  const [running, setRunning] = useState(false);
  const columns: Column<ReconciliationRun>[] = [
    { key: 'when', header: t('when'), cell: (row) => <span className="font-semibold text-navy">{formatDateTime(row.createdAt, locale)}</span>, hideOnCard: true },
    { key: 'source', header: t('source'), cell: (row) => enumLabel('reconciliationSource', row.source) },
    { key: 'lender', header: t('lender'), cell: (row) => row.lenderName ?? t('anyLender') },
    { key: 'matched', header: t('matched'), cell: (row) => <span className="tabular">{t('matchedLine', { matched: row.matchedCount, total: row.lineCount })}</span> },
    { key: 'amount', header: t('amount'), cell: (row) => <span className="tabular">{`${formatPaise(row.matchedPaise, locale)} / ${formatPaise(row.totalPaise, locale)}`}</span>, className: 'text-right' },
    { key: 'unmatched', header: t('unmatched'), cell: (row) => (row.unmatched.length === 0 ? '—' : <span className="text-[13px] text-destructive">{row.unmatched.map((line) => `${line.reference} (${enumLabel('unmatchedReason', line.reason)})`).join(', ')}</span>) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button size="sm" onClick={() => setRunning(true)}>
            <Icon name="balance" size={16} />
            {t('new')}
          </Button>
        }
      />
      <PagedList result={runs} columns={columns} rowKey={(row) => row.id} title={(row) => formatDateTime(row.createdAt, locale)} empty={<EmptyState icon="balance" title={t('emptyTitle')} body={t('emptyBody')} />} />
      <RunDialog key={running ? 'open' : 'closed'} open={running} onOpenChange={setRunning} />
    </div>
  );
}
