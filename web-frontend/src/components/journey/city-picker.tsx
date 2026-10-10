'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { SearchInput } from '@/components/data/search-input';
import { StaggerList, StaggerListItem } from '@/components/motion/stagger';
import { Icon } from '@/components/ui/icon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { citySearchQuery, pincodeQuery } from '@/lib/api/catalog';
import { CITY_SEARCH_MIN_LENGTH, PINCODE_PATTERN } from '@/lib/constants/journey.constants';
import { cn } from '@/lib/utils';

export type CityChoice = { cityId?: string; city?: string; pincode?: string; label: string };

const CUSTOM_MIN_LENGTH = 3;

type Props = { open: boolean; onOpenChange: (open: boolean) => void; title: string; selected?: string | null; onSelect: (choice: CityChoice) => void; allowCustom?: boolean };

export function CityPicker({ open, onOpenChange, title, selected, onSelect, allowCustom = true }: Props) {
  const t = useTranslations('flow.city');
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const isPincode = PINCODE_PATTERN.test(q);
  const cities = useQuery({ ...citySearchQuery(q), enabled: open && !isPincode && q.length >= CITY_SEARCH_MIN_LENGTH });
  const pincode = useQuery({ ...pincodeQuery(q), enabled: open && isPincode });
  const items = cities.data?.items ?? [];
  const exact = items.some((city) => city.name.toLowerCase() === q.toLowerCase());
  const canUseCustom = allowCustom && !isPincode && q.length >= CUSTOM_MIN_LENGTH && !exact;
  const pick = (choice: CityChoice) => {
    onSelect(choice);
    setQuery('');
    onOpenChange(false);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85dvh] w-full max-w-[560px] gap-3 px-4 pt-4 pb-4 safe-bottom">
        <span className="mx-auto h-1 w-10 rounded-full bg-[#e7e8eb]" aria-hidden="true" />
        <SheetHeader className="p-0">
          <SheetTitle className="font-heading text-lg font-semibold text-navy">{title}</SheetTitle>
          <SheetDescription>{t('hint')}</SheetDescription>
        </SheetHeader>
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')} autoFocus maxLength={60} />
        <div className="-mx-1 min-h-40 overflow-y-auto px-1">
          {cities.isFetching || pincode.isFetching ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <StaggerList className="flex flex-col gap-1" step={0.03}>
              {pincode.data?.city ? (
                <StaggerListItem>
                  <CityRow label={pincode.data.city.name} detail={`${pincode.data.pincode} · ${pincode.data.state?.name ?? ''}`} on={selected === pincode.data.city.name} onClick={() => pick({ cityId: pincode.data.city?.id, pincode: pincode.data.pincode, label: pincode.data.city?.name ?? '' })} />
                </StaggerListItem>
              ) : null}
              {canUseCustom ? (
                <StaggerListItem>
                  <CityRow label={t('useTyped', { city: q })} custom on={false} onClick={() => pick({ city: q, label: q })} />
                </StaggerListItem>
              ) : null}
              {items.map((city) => (
                <StaggerListItem key={city.id}>
                  <CityRow label={city.name} detail={city.state.name} on={selected === city.name} onClick={() => pick({ cityId: city.id, label: city.name })} />
                </StaggerListItem>
              ))}
              {q.length < CITY_SEARCH_MIN_LENGTH ? <li className="px-2 py-4 text-center text-sm text-muted-foreground">{t('typeMore')}</li> : null}
              {isPincode && pincode.isError ? <li className="px-2 py-4 text-center text-sm text-muted-foreground">{t('pincodeUnknown')}</li> : null}
            </StaggerList>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CityRow({ label, detail, on, custom, onClick }: { label: string; detail?: string; on: boolean; custom?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn('flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none', on && 'bg-background')}>
      <Icon name="location" size={18} className={custom ? 'text-gold-ink' : on ? 'text-navy' : 'text-slate'} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate text-[15px] text-foreground', on && 'font-semibold text-navy')}>{label}</span>
        {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {on ? <Icon name="check" size={16} className="text-gold-ink" /> : null}
    </button>
  );
}
