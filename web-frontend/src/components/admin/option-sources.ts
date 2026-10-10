'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';

import { adminOptionsQuery } from '@/lib/api/admin';
import { statesQuery } from '@/lib/api/catalog';
import type { OptionSource } from '@/lib/constants/admin-resources.constants';
import { textOf } from '@/lib/format/fact';
import { pickText } from '@/lib/format/localised';

export type Option = { value: string; label: string };

const ACTIVE = 'active';

const usable = <T extends Record<string, unknown>>(items: T[] | undefined) => (items ?? []).filter((item) => item.status === undefined || item.status === ACTIVE);

const text = (value: unknown, locale: string) => (typeof value === 'string' ? value : value && typeof value === 'object' ? pickText(value as Record<string, string>, locale) : '');

export function useOptionSource(source: OptionSource | undefined, scope: Record<string, string | undefined> = {}): Option[] {
  const locale = useLocale();
  const states = useQuery({ ...statesQuery(), enabled: source === 'states' });
  const cities = useQuery({ ...adminOptionsQuery('cities', 'GET /admin/geo/cities', { state: scope.stateGstCode }), enabled: source === 'cities' });
  const segments = useQuery({ ...adminOptionsQuery('segments', 'GET /admin/segments', { status: 'active' }), enabled: source === 'segments' });
  const categories = useQuery({ ...adminOptionsQuery('categories', 'GET /admin/loan-categories', { status: 'active' }), enabled: source === 'categories' });
  const leadSources = useQuery({ ...adminOptionsQuery('leadSources', 'GET /admin/lead-sources', { status: 'active' }), enabled: source === 'leadSources' });
  const attributes = useQuery({ ...adminOptionsQuery('attributes', 'GET /admin/attributes', { status: 'active' }), enabled: source === 'attributes' });
  const schemes = useQuery({ ...adminOptionsQuery('commissionSchemes', 'GET /admin/commission-schemes', { status: 'active' }), enabled: source === 'commissionSchemes' });
  switch (source) {
    case 'states':
      return (states.data?.items ?? []).map((state) => ({ value: state.gstCode, label: state.name }));
    case 'cities':
      return usable(cities.data?.items).map((city) => ({ value: textOf(city.id), label: text(city.name, locale) }));
    case 'segments':
      return usable(segments.data?.items).map((segment) => ({ value: textOf(segment.key), label: text(segment.label, locale) }));
    case 'categories':
      return usable(categories.data?.items).map((category) => ({ value: textOf(category.id), label: text(category.label, locale) }));
    case 'leadSources':
      return usable(leadSources.data?.items).map((item) => ({ value: textOf(item.id), label: text(item.name, locale) }));
    case 'attributes':
      return usable(attributes.data?.items).map((item) => ({ value: textOf(item.key), label: `${text(item.label, locale)} · ${textOf(item.key)}` }));
    case 'commissionSchemes':
      return usable(schemes.data?.items).map((item) => ({ value: textOf(item.key), label: `${text(item.name, locale)} · ${textOf(item.key)}` }));
    default:
      return [];
  }
}
