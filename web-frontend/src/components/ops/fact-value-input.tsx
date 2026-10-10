'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AttributeDefinition } from '@/lib/api/types/admin.types';
import { AttributeDataType } from '@/lib/format/fact';
import { pickText } from '@/lib/format/localised';

const NUMERIC: readonly string[] = [AttributeDataType.Integer, AttributeDataType.Decimal, AttributeDataType.Percentage, AttributeDataType.Money];

type Props = { id: string; attribute: AttributeDefinition | undefined; value: string; onChange: (value: string) => void; label: string; disabled?: boolean };

export function FactValueInput({ id, attribute, value, onChange, label, disabled }: Props) {
  const t = useTranslations('common');
  const locale = useLocale();
  const type = attribute?.dataType;
  if (type === AttributeDataType.Boolean || type === AttributeDataType.Enum) {
    const options = type === AttributeDataType.Boolean ? [{ value: 'true', label: t('yes') }, { value: 'false', label: t('no') }] : (attribute?.enumValues ?? []).map((option) => ({ value: option.value, label: pickText(option.label, locale) || option.value }));
    return (
      <Select value={value || null} onValueChange={(next) => onChange(String(next))} disabled={disabled}>
        <SelectTrigger id={id} size="sm" className="h-11 w-full" aria-label={label}>
          <SelectValue>{(current: string | null) => (current ? (options.find((option) => option.value === current)?.label ?? current) : t('choose'))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={type && NUMERIC.includes(type) ? 'decimal' : undefined}
        type={type === AttributeDataType.Date ? 'date' : 'text'}
        aria-label={label}
        disabled={disabled}
        className={type && NUMERIC.includes(type) ? 'tabular' : undefined}
      />
      {type === AttributeDataType.Money ? <span className="text-[11px] text-muted-foreground">{t('inRupees')}</span> : null}
    </div>
  );
}
