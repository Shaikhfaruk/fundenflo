'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Section } from '@/components/data/detail-section';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/chip-group';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { usePartnerOwner } from '@/hooks/use-partner-owner';
import { categoriesQuery, segmentsQuery, statesQuery } from '@/lib/api/catalog';
import { partnerCapacityQuery, partnerKeys, replaceServiceAreas, serviceAreasQuery, updatePartnerCapacity } from '@/lib/api/partners';
import type { PartnerCapacity, ServiceArea } from '@/lib/api/types/partner.types';
import { PINCODE_PATTERN } from '@/lib/constants/journey.constants';
import { MAX_OPEN_LEADS_LIMIT, SERVICE_LANGUAGES, WEEK_DAYS } from '@/lib/constants/partner.constants';

const toggle = <T,>(values: T[], value: T) => (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

const splitPincodes = (text: string) => text.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean);

function CapacityForm({ capacity, editable }: { capacity: PartnerCapacity; editable: boolean }) {
  const t = useTranslations('partner.settings');
  const tLanguages = useTranslations('languages');
  const dayLabel = useEnumLabel('weekday');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const segments = useQuery(segmentsQuery());
  const categories = useQuery(categoriesQuery());
  const [paused, setPaused] = useState(capacity.paused);
  const [maxOpen, setMaxOpen] = useState(capacity.maxOpenLeads === null ? '' : String(capacity.maxOpenLeads));
  const [days, setDays] = useState<number[]>(capacity.workingDays);
  const [start, setStart] = useState(capacity.workingHours?.start ?? '');
  const [end, setEnd] = useState(capacity.workingHours?.end ?? '');
  const [languages, setLanguages] = useState<string[]>(capacity.languages);
  const [chosenSegments, setChosenSegments] = useState<string[]>(capacity.segments);
  const [chosenCategories, setChosenCategories] = useState<string[]>(capacity.categories);
  const maxValue = maxOpen.trim() === '' ? null : Number(maxOpen);
  const maxValid = maxValue === null || (Number.isInteger(maxValue) && maxValue >= 0 && maxValue <= MAX_OPEN_LEADS_LIMIT);
  const hoursGiven = start !== '' || end !== '';
  const hoursValid = !hoursGiven || (start !== '' && end !== '' && start < end);
  const save = useMutation({
    mutationFn: () =>
      updatePartnerCapacity(
        { paused, maxOpenLeads: maxValue, workingDays: days.toSorted((a, b) => a - b), workingHours: hoursGiven ? { start, end } : null, languages, segments: chosenSegments, categories: chosenCategories },
        capacity.version,
      ),
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(partnerKeys.capacity(), next);
      void queryClient.invalidateQueries({ queryKey: partnerKeys.profile() });
      toast.success(t('saved'));
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <div className="flex flex-col gap-4">
      <ToggleRow title={t('paused')} description={t('pausedBody')} checked={paused} onCheckedChange={setPaused} disabled={!editable} />
      <Field data-invalid={!maxValid} className="max-w-60">
        <FieldLabel htmlFor="capacity-max">{t('maxOpen')}</FieldLabel>
        <Input id="capacity-max" type="number" inputMode="numeric" min={0} max={MAX_OPEN_LEADS_LIMIT} value={maxOpen} disabled={!editable} onChange={(event) => setMaxOpen(event.target.value)} />
        <FieldDescription>{t('maxOpenHint')}</FieldDescription>
      </Field>
      <ChipGroup label={t('days')} showLabel>
        {WEEK_DAYS.map((day) => (
          <ChoiceChip key={day} selected={days.includes(day)} label={dayLabel(String(day))} onToggle={() => (editable ? setDays(toggle(days, day)) : undefined)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      <div className="grid max-w-md grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="capacity-start">{t('start')}</FieldLabel>
          <Input id="capacity-start" type="time" value={start} disabled={!editable} onChange={(event) => setStart(event.target.value)} />
        </Field>
        <Field data-invalid={!hoursValid}>
          <FieldLabel htmlFor="capacity-end">{t('end')}</FieldLabel>
          <Input id="capacity-end" type="time" value={end} disabled={!editable} onChange={(event) => setEnd(event.target.value)} />
          {!hoursValid ? <FieldError>{t('hoursInvalid')}</FieldError> : null}
        </Field>
      </div>
      <ChipGroup label={t('languages')} showLabel>
        {SERVICE_LANGUAGES.map((code) => (
          <ChoiceChip key={code} selected={languages.includes(code)} label={tLanguages.has(code) ? tLanguages(code) : code} onToggle={() => (editable ? setLanguages(toggle(languages, code)) : undefined)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      <ChipGroup label={t('segments')} showLabel>
        {segments.data?.items.map((item) => (
          <ChoiceChip key={item.key} selected={chosenSegments.includes(item.key)} label={item.label} onToggle={() => (editable ? setChosenSegments(toggle(chosenSegments, item.key)) : undefined)} className="min-h-9 text-[13px]" />
        ))}
      </ChipGroup>
      <ChipGroup label={t('categories')} showLabel>
        {categories.data?.items.map((item) => (
          <ChoiceChip key={item.key} selected={chosenCategories.includes(item.key)} label={item.label} onToggle={() => (editable ? setChosenCategories(toggle(chosenCategories, item.key)) : undefined)} className="min-h-9 text-xs" />
        ))}
      </ChipGroup>
      {editable ? (
        <Button size="sm" className="self-start" disabled={!maxValid || !hoursValid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Spinner /> : null}
          {t('save')}
        </Button>
      ) : null}
    </div>
  );
}

function AreasForm({ areas, editable }: { areas: ServiceArea[]; editable: boolean }) {
  const t = useTranslations('partner.settings');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const states = useQuery(statesQuery());
  const [chosenStates, setChosenStates] = useState<string[]>(areas.flatMap((area) => (area.state && !area.city && !area.pincode ? [area.state.gstCode] : [])));
  const [pincodes, setPincodes] = useState(areas.flatMap((area) => (area.pincode ? [area.pincode] : [])).join(', '));
  const cities = areas.flatMap((area) => (area.city ? [area.city] : []));
  const pincodeList = splitPincodes(pincodes);
  const pincodesValid = pincodeList.every((value) => PINCODE_PATTERN.test(value));
  const save = useMutation({
    mutationFn: () => replaceServiceAreas([...chosenStates.map((stateGstCode) => ({ stateGstCode })), ...cities.map((city) => ({ cityId: city.id })), ...[...new Set(pincodeList)].map((pincode) => ({ pincode }))]),
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(partnerKeys.serviceAreas(), next);
      void queryClient.invalidateQueries({ queryKey: partnerKeys.profile() });
      toast.success(t('areasSaved'));
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <div className="flex flex-col gap-4">
      <ChipGroup label={t('states')} showLabel>
        {states.data?.items.map((state) => (
          <ChoiceChip key={state.gstCode} selected={chosenStates.includes(state.gstCode)} label={state.name} onToggle={() => (editable ? setChosenStates(toggle(chosenStates, state.gstCode)) : undefined)} className="min-h-8 text-xs" />
        ))}
      </ChipGroup>
      {cities.length > 0 ? <p className="text-xs text-muted-foreground">{t('cities', { names: cities.map((city) => city.name).join(', ') })}</p> : null}
      <Field data-invalid={!pincodesValid}>
        <FieldLabel htmlFor="areas-pincodes">{t('pincodes')}</FieldLabel>
        <Input id="areas-pincodes" value={pincodes} disabled={!editable} onChange={(event) => setPincodes(event.target.value)} />
        {pincodesValid ? <FieldDescription>{t('pincodesHint')}</FieldDescription> : <FieldError>{t('pincodesInvalid')}</FieldError>}
      </Field>
      {editable ? (
        <Button size="sm" className="self-start" disabled={!pincodesValid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Spinner /> : null}
          {t('saveAreas')}
        </Button>
      ) : null}
    </div>
  );
}

export function PartnerSettings() {
  const t = useTranslations('partner.settings');
  const { owner } = usePartnerOwner();
  const capacity = useQuery(partnerCapacityQuery());
  const areas = useQuery(serviceAreasQuery());
  if (capacity.isPending || areas.isPending) return <ScreenSkeleton />;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={owner ? t('description') : t('ownerOnly')} />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <Section title={t('capacity')}>{capacity.data ? <CapacityForm key={capacity.data.version} capacity={capacity.data} editable={owner} /> : null}</Section>
        <Section title={t('areas')} delay={0.04}>
          {areas.data ? <AreasForm key={areas.data.items.map((area) => area.id).join()} areas={areas.data.items} editable={owner} /> : null}
        </Section>
      </div>
    </div>
  );
}
