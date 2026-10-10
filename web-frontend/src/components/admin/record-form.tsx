'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useEnumLabels } from '@/hooks/use-enum-label';
import type { AdminRecord } from '@/lib/api/admin';
import type { FieldSpec } from '@/lib/constants/admin-resources.constants';
import { DEFAULT_LOCALE } from '@/lib/constants/locale.constants';
import { paiseFromRupees, rupeesFromPaiseValue } from '@/lib/format/money';

import { type Option, useOptionSource } from './option-sources';

export type FormMode = 'create' | 'edit';

export type FormValue = string | boolean | string[];

export type FormValues = Record<string, FormValue>;

const JSON_INDENT = 2;

const NONE = '__none__';

const fieldsFor = (fields: FieldSpec[], mode: FormMode) => fields.filter((field) => (mode === 'create' ? field.create !== false : field.edit !== false));

const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

const textOf = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

function initialOf(field: FieldSpec, value: unknown): FormValue {
  switch (field.kind) {
    case 'boolean':
      return value === true;
    case 'multiselect':
      return Array.isArray(value) ? value.map(String) : [];
    case 'localised':
    case 'longLocalised':
      return value && typeof value === 'object' ? textOf((value as Record<string, unknown>)[DEFAULT_LOCALE]) : '';
    case 'money':
      return typeof value === 'number' ? String(rupeesFromPaiseValue(value)) : '';
    case 'list':
    case 'integerList':
      return Array.isArray(value) ? value.join(', ') : '';
    case 'json':
      return value === null || value === undefined ? '' : JSON.stringify(value, null, JSON_INDENT);
    case 'date':
      return typeof value === 'string' ? value.slice(0, 10) : '';
    default:
      return textOf(value);
  }
}

export const initialValues = (fields: FieldSpec[], record: AdminRecord | null): FormValues => Object.fromEntries(fields.map((field) => [field.name, initialOf(field, record?.[field.name])]));

const isEmpty = (value: FormValue) => (Array.isArray(value) ? value.length === 0 : typeof value === 'string' ? value.trim() === '' : false);

type Parsed = { ok: true; value: unknown } | { ok: false };

function parse(field: FieldSpec, value: FormValue, record: AdminRecord | null): Parsed {
  const raw = typeof value === 'string' ? value.trim() : value;
  switch (field.kind) {
    case 'boolean':
    case 'multiselect':
      return { ok: true, value: raw };
    case 'integer': {
      const number = Number(raw);
      return Number.isInteger(number) ? { ok: true, value: number } : { ok: false };
    }
    case 'money': {
      const number = Number(raw);
      return Number.isFinite(number) && number > 0 ? { ok: true, value: paiseFromRupees(number) } : { ok: false };
    }
    case 'integerList': {
      const numbers = split(String(raw)).map(Number);
      return numbers.every(Number.isInteger) ? { ok: true, value: numbers } : { ok: false };
    }
    case 'list':
      return { ok: true, value: split(String(raw)) };
    case 'localised':
    case 'longLocalised': {
      const existing = record?.[field.name];
      return { ok: true, value: { ...(existing && typeof existing === 'object' ? existing : {}), [DEFAULT_LOCALE]: raw } };
    }
    case 'json':
      try {
        return { ok: true, value: JSON.parse(String(raw)) };
      } catch {
        return { ok: false };
      }
    default:
      return { ok: true, value: raw };
  }
}

export type BuildResult = { body: Record<string, unknown>; invalid: string[] };

export function buildBody(fields: FieldSpec[], values: FormValues, mode: FormMode, record: AdminRecord | null): BuildResult {
  const initial = initialValues(fields, record);
  const body: Record<string, unknown> = {};
  const invalid: string[] = [];
  for (const field of fieldsFor(fields, mode)) {
    const value = values[field.name] ?? '';
    const unchanged = mode === 'edit' && JSON.stringify(value) === JSON.stringify(initial[field.name]);
    if (unchanged) continue;
    if (isEmpty(value)) {
      if (field.required) invalid.push(field.name);
      else if (mode === 'edit' && field.nullable) body[field.name] = null;
      continue;
    }
    const parsed = parse(field, value, record);
    if (parsed.ok) body[field.name] = parsed.value;
    else invalid.push(field.name);
  }
  return { body, invalid };
}

function SelectField({ field, value, options, onChange, label }: { field: FieldSpec; value: string; options: Option[]; onChange: (value: string) => void; label: string }) {
  const t = useTranslations('admin.common');
  const current = options.find((option) => option.value === value);
  return (
    <Select value={value === '' ? NONE : value} onValueChange={(next) => onChange(String(next) === NONE ? '' : String(next))}>
      <SelectTrigger size="sm" className="h-11 w-full" aria-label={label}>
        <SelectValue>{() => current?.label ?? (value || t('choose'))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {field.required ? null : <SelectItem value={NONE}>{t('none')}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldInput({ field, value, values, onChange, invalid }: { field: FieldSpec; value: FormValue; values: FormValues; onChange: (value: FormValue) => void; invalid: boolean }) {
  const t = useTranslations('admin.fields');
  const tCommon = useTranslations('admin.common');
  const enumLabel = useEnumLabels();
  const id = useId();
  const sourced = useOptionSource(field.source, { stateGstCode: typeof values.stateGstCode === 'string' ? values.stateGstCode : undefined });
  const options: Option[] = field.options ? field.options.map((option) => ({ value: option, label: field.optionsEnum ? enumLabel(field.optionsEnum, option) : option })) : sourced;
  const labelKey = field.labelKey ?? field.name;
  const label = `${t.has(labelKey) ? t(labelKey) : field.name}${field.required ? ' *' : ''}`;
  if (field.kind === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-subtle p-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <Switch id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
      </div>
    );
  }
  if (field.kind === 'multiselect') {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <ChipGroup label={label} showLabel>
        {options.map((option) => (
          <ChoiceChip key={option.value} selected={chosen.includes(option.value)} label={option.label} onToggle={() => onChange(chosen.includes(option.value) ? chosen.filter((item) => item !== option.value) : [...chosen, option.value])} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
    );
  }
  const text = typeof value === 'string' ? value : '';
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {field.kind === 'select' ? (
        <SelectField field={field} value={text} options={options} onChange={onChange} label={label} />
      ) : field.kind === 'longText' || field.kind === 'longLocalised' || field.kind === 'json' ? (
        <Textarea id={id} rows={field.kind === 'json' ? 8 : 4} value={text} onChange={(event) => onChange(event.target.value)} className={field.kind === 'json' ? 'max-h-80 overflow-y-auto font-mono text-xs' : 'max-h-80 overflow-y-auto'} aria-invalid={invalid} spellCheck={field.kind !== 'json'} />
      ) : (
        <Input
          id={id}
          type={field.kind === 'integer' || field.kind === 'money' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
          inputMode={field.kind === 'integer' || field.kind === 'money' ? 'numeric' : undefined}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          autoComplete="off"
        />
      )}
      {invalid ? <FieldError>{field.kind === 'json' ? tCommon('jsonInvalid') : isEmpty(value) ? tCommon('required') : tCommon('invalid')}</FieldError> : null}
    </Field>
  );
}

type Props = { fields: FieldSpec[]; mode: FormMode; values: FormValues; invalid: string[]; onChange: (name: string, value: FormValue) => void };

export function RecordForm({ fields, mode, values, invalid, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {fieldsFor(fields, mode).map((field) => (
        <FieldInput key={field.name} field={field} value={values[field.name] ?? ''} values={values} invalid={invalid.includes(field.name)} onChange={(value) => onChange(field.name, value)} />
      ))}
    </div>
  );
}
