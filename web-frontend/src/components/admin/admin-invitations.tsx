'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MobileInput } from '@/components/ui/mobile-input';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { adminKeys, createInvitation, invitationsQuery, revokeInvitation } from '@/lib/api/admin';
import type { Invitation } from '@/lib/api/types/admin.types';
import { INVITATION_STATUSES, InvitationStatus, OrganizationType } from '@/lib/constants/admin.constants';
import { DEFAULT_COUNTRY_CODE, INDIAN_MOBILE_PATTERN } from '@/lib/constants/auth.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';

import { useOrganizationOptions } from './organization-options';
import { OrganizationRoleFields } from './organization-role-fields';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('admin.invitations');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const organizations = useOrganizationOptions(open);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const organization = organizations.find((item) => item.id === organizationId);
  const byMobile = organization?.type === OrganizationType.Partner;
  const contactValid = byMobile ? INDIAN_MOBILE_PATTERN.test(mobile) : EMAIL_PATTERN.test(email.trim());
  const invite = useMutation({
    mutationFn: () => createInvitation({ organizationId: organizationId ?? '', role: role ?? '', ...(byMobile ? { mobile, countryCode: DEFAULT_COUNTRY_CODE } : { email: email.trim() }) }),
    meta: { handlesError: true },
    onSuccess: (invitation) => {
      toast.success(t('sent', { recipient: invitation.recipient }));
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('inviteTitle')} description={t('inviteBody')} confirmLabel={t('send')} pending={invite.isPending} confirmDisabled={!organizationId || !role || !contactValid} onConfirm={() => invite.mutate()}>
      <OrganizationRoleFields
        organizations={organizations}
        organizationId={organizationId}
        role={role}
        onOrganization={(id) => {
          setOrganizationId(id);
          setRole(null);
        }}
        onRole={setRole}
      />
      {byMobile ? (
        <Field>
          <FieldLabel htmlFor="invite-mobile">{t('mobile')}</FieldLabel>
          <MobileInput id="invite-mobile" value={mobile} onValueChange={setMobile} valid={INDIAN_MOBILE_PATTERN.test(mobile)} />
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="invite-email">{t('email')}</FieldLabel>
          <Input id="invite-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
      )}
    </ConfirmDialog>
  );
}

export function AdminInvitations() {
  const t = useTranslations('admin.invitations');
  const tRoles = useTranslations('roles');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [status, setStatus] = useState<string>(InvitationStatus.Pending);
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const invitations = useInfiniteQuery(invitationsQuery({ status: anyToUndefined(status) }));
  const revoke = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('revoked'));
      setRevoking(null);
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
    onError: (failure) => errorToast(failure),
  });
  const columns: Column<Invitation>[] = [
    { key: 'recipient', header: t('recipient'), cell: (row) => <span className="font-semibold text-navy tabular">{row.recipient}</span>, hideOnCard: true },
    { key: 'organization', header: t('organization'), cell: (row) => row.organization.name },
    { key: 'role', header: t('role'), cell: (row) => (tRoles.has(row.role) ? tRoles(row.role) : row.role) },
    { key: 'expires', header: t('expires'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.expiresAt, locale)}</span> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} /> },
    {
      key: 'actions',
      header: '',
      cell: (row) =>
        row.status === InvitationStatus.Pending ? (
          <Button size="xs" variant="ghost" className="text-destructive" onClick={() => setRevoking(row)}>
            {t('revoke')}
          </Button>
        ) : null,
      className: 'text-right',
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button size="sm" onClick={() => setInviting(true)}>
            <Icon name="person-add" size={16} />
            {t('invite')}
          </Button>
        }
      />
      <FilterBar onRefresh={() => void invitations.refetch()} refreshing={invitations.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={INVITATION_STATUSES} label={t('status')} allLabel={t('anyStatus')} labelOf={(value) => enumLabel('invitationStatus', value)} />
      </FilterBar>
      <PagedList result={invitations} columns={columns} rowKey={(row) => row.id} title={(row) => <span className="tabular">{row.recipient}</span>} empty={<EmptyState icon="mail" title={t('emptyTitle')} body={status === ANY_VALUE ? t('emptyAll') : t('emptyBody')} />} />
      <InviteDialog key={inviting ? 'open' : 'closed'} open={inviting} onOpenChange={setInviting} />
      <ConfirmDialog open={revoking !== null} onOpenChange={(open) => (open ? null : setRevoking(null))} title={t('revokeTitle', { recipient: revoking?.recipient ?? '' })} description={t('revokeBody')} confirmLabel={t('revoke')} destructive pending={revoke.isPending} onConfirm={() => (revoking ? revoke.mutate(revoking.id) : null)} />
    </div>
  );
}
