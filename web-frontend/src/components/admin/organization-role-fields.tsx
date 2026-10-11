'use client';

import { useTranslations } from 'next-intl';

import { SearchSelect } from '@/components/data/search-select';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLES_BY_ORGANIZATION } from '@/lib/constants/admin.constants';

import { type OrganizationOption, useOrganizationSearch } from './organization-options';

type Props = { open: boolean; organization: OrganizationOption | null; role: string | null; onOrganization: (organization: OrganizationOption | null) => void; onRole: (role: string) => void };

export function OrganizationRoleFields({ open, organization, role, onOrganization, onRole }: Props) {
  const t = useTranslations('admin.organizations');
  const tRoles = useTranslations('roles');
  const tTypes = useTranslations('enums.organizationType');
  const { organizations, loading, setQuery } = useOrganizationSearch(open);
  const labelOf = (item: OrganizationOption) => `${item.name} · ${tTypes.has(item.type) ? tTypes(item.type) : item.type}`;
  const roles = organization ? (ROLES_BY_ORGANIZATION[organization.type] ?? []) : [];
  return (
    <>
      <SearchSelect
        label={t('organization')}
        placeholder={t('searchOrganization')}
        value={organization ? { value: organization.id, label: labelOf(organization) } : null}
        onChange={(option) => onOrganization(organizations.find((item) => item.id === option?.value) ?? null)}
        options={organizations.map((item) => ({ value: item.id, label: labelOf(item) }))}
        loading={loading}
        onQueryChange={setQuery}
        emptyText={t('noOrganization')}
        loadingText={t('searching')}
      />
      <Field>
        <FieldLabel>{t('role')}</FieldLabel>
        <Select value={role} onValueChange={(value) => onRole(String(value))} disabled={!organization}>
          <SelectTrigger size="sm" className="h-11 w-full" aria-label={t('role')}>
            <SelectValue>{(current: string | null) => (current ? (tRoles.has(current) ? tRoles(current) : current) : t('chooseRole'))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((item) => (
              <SelectItem key={item} value={item}>
                {tRoles.has(item) ? tRoles(item) : item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}
