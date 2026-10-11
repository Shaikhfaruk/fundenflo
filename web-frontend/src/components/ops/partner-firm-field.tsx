'use client';

import { useTranslations } from 'next-intl';

import { type SearchOption, SearchSelect } from '@/components/data/search-select';
import { useFirmSearch } from '@/hooks/use-firm-search';

type Props = { open: boolean; value: SearchOption | null; onChange: (option: SearchOption | null) => void };

export function PartnerFirmField({ open, value, onChange }: Props) {
  const t = useTranslations('ops.partnerFirm');
  const { firms, loading, setQuery } = useFirmSearch(open);
  return (
    <SearchSelect
      label={t('label')}
      placeholder={t('placeholder')}
      value={value}
      onChange={onChange}
      options={firms.map((firm) => ({ value: firm.organizationId, label: firm.name }))}
      loading={loading}
      onQueryChange={setQuery}
      emptyText={t('empty')}
      loadingText={t('searching')}
    />
  );
}
