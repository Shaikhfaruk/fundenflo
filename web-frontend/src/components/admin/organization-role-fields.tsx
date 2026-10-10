'use client';

import { useTranslations } from 'next-intl';

import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLES_BY_ORGANIZATION } from '@/lib/constants/admin.constants';

import type { OrganizationOption } from './organization-options';

type Props = { organizations: OrganizationOption[]; organizationId: string | null; role: string | null; onOrganization: (id: string) => void; onRole: (role: string) => void };

export function OrganizationRoleFields({ organizations, organizationId, role, onOrganization, onRole }: Props) {
  const t = useTranslations('admin.organizations');
  const tRoles = useTranslations('roles');
  const tTypes = useTranslations('enums.organizationType');
  const organization = organizations.find((item) => item.id === organizationId);
  const roles = organization ? (ROLES_BY_ORGANIZATION[organization.type] ?? []) : [];
  return (
    <>
      <Field>
        <FieldLabel>{t('organization')}</FieldLabel>
        <Select value={organizationId} onValueChange={(value) => onOrganization(String(value))}>
          <SelectTrigger size="sm" className="h-11 w-full" aria-label={t('organization')}>
            <SelectValue>{() => (organization ? `${organization.name} · ${tTypes.has(organization.type) ? tTypes(organization.type) : organization.type}` : t('chooseOrganization'))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {organizations.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {`${item.name} · ${tTypes.has(item.type) ? tTypes(item.type) : item.type}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
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
