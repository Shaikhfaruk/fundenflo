'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const ANY_VALUE = 'any';

type Props = { value: string; onChange: (value: string) => void; values: readonly string[]; label: string; labelOf: (value: string) => string; allLabel?: string; className?: string };

export function EnumSelect({ value, onChange, values, label, labelOf, allLabel, className }: Props) {
  return (
    <Select value={value} onValueChange={(next) => onChange(String(next))}>
      <SelectTrigger size="sm" className={cn('h-11 w-full sm:w-48', className)} aria-label={label}>
        <SelectValue>{(current: string) => (current === ANY_VALUE ? (allLabel ?? label) : labelOf(current))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value={ANY_VALUE}>{allLabel}</SelectItem> : null}
        {values.map((option) => (
          <SelectItem key={option} value={option}>
            {labelOf(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const anyToUndefined = (value: string) => (value === ANY_VALUE ? undefined : value);
