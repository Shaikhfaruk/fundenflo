'use client';

import { useId } from 'react';

import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxStatus } from '@/components/ui/combobox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { SEARCH_TYPING_REASONS } from '@/lib/constants/search.constants';

export type SearchOption = { value: string; label: string };

type Props = {
  label: string;
  placeholder: string;
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  options: SearchOption[];
  loading: boolean;
  onQueryChange: (query: string) => void;
  emptyText: string;
  loadingText: string;
};

const labelOf = (option: SearchOption) => option.label;

const sameOption = (option: SearchOption, current: SearchOption) => option.value === current.value;

export function SearchSelect({ label, placeholder, value, onChange, options, loading, onQueryChange, emptyText, loadingText }: Props) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox<SearchOption>
        items={options}
        filter={null}
        value={value}
        onValueChange={onChange}
        onInputValueChange={(query, details) => (SEARCH_TYPING_REASONS.has(details.reason) ? onQueryChange(query.trim()) : null)}
        itemToStringLabel={labelOf}
        isItemEqualToValue={sameOption}
      >
        <ComboboxInput id={id} size="sm" placeholder={placeholder} />
        <ComboboxContent>
          <ComboboxStatus>
            {loading ? (
              <>
                <Spinner />
                {loadingText}
              </>
            ) : null}
          </ComboboxStatus>
          <ComboboxEmpty>{loading ? null : emptyText}</ComboboxEmpty>
          <ComboboxList>
            {(option: SearchOption) => (
              <ComboboxItem key={option.value} value={option}>
                <span className="truncate">{option.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}
