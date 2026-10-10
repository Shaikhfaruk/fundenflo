'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { KeyValues, Section } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { SearchInput } from '@/components/data/search-input';
import { StatusBadge } from '@/components/data/status-badge';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { adminKeys, adminUserQuery, adminUsersQuery, createMembership, updateAdminUser, updateMembership } from '@/lib/api/admin';
import type { AdminMembership, AdminUser, AdminUserDetail } from '@/lib/api/types/admin.types';
import { MEMBERSHIP_STATUSES, USER_STATUSES, UserStatus } from '@/lib/constants/admin.constants';
import { MIN_SEARCH_LENGTH } from '@/lib/constants/lead.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime, formatRelative } from '@/lib/format/date';

import { useOrganizationOptions } from './organization-options';
import { OrganizationRoleFields } from './organization-role-fields';

export function AdminUsers() {
  const t = useTranslations('admin.users');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>(ANY_VALUE);
  const users = useInfiniteQuery(adminUsersQuery({ q: q.trim().length >= MIN_SEARCH_LENGTH ? q.trim() : undefined, status: anyToUndefined(status) }));
  const title = (row: AdminUser) => (
    <Link href={RoutePath.adminUser(row.id)} className="truncate font-semibold text-navy hover:underline">
      {row.fullName ?? t('unnamed')}
    </Link>
  );
  const columns: Column<AdminUser>[] = [
    { key: 'name', header: t('name'), cell: title, hideOnCard: true },
    { key: 'memberships', header: t('memberships'), cell: (row) => <span className="tabular">{row.memberships}</span> },
    { key: 'signup', header: t('signup'), cell: (row) => enumLabel('signupChannel', row.signupChannel) },
    { key: 'lastLogin', header: t('lastLogin'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.lastLoginAt, locale)}</span> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} /> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void users.refetch()} refreshing={users.isFetching}>
        <SearchInput value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('search')} aria-label={t('search')} className="sm:w-72" />
        <EnumSelect value={status} onChange={setStatus} values={USER_STATUSES} label={t('status')} allLabel={t('anyStatus')} labelOf={(value) => enumLabel('userStatus', value)} />
      </FilterBar>
      <PagedList result={users} columns={columns} rowKey={(row) => row.id} title={title} empty={<EmptyState icon="group" title={t('emptyTitle')} body={t('emptyBody')} />} />
    </div>
  );
}

function AddMembership({ user, open, onOpenChange }: { user: AdminUserDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('admin.users');
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const organizations = useOrganizationOptions(open);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => createMembership({ userId: user.id, organizationId: organizationId ?? '', role: role ?? '' }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('membershipAdded'));
      void queryClient.invalidateQueries({ queryKey: adminKeys.user(user.id) });
      onOpenChange(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={t('addMembership')} description={t('addMembershipBody')} confirmLabel={t('add')} pending={add.isPending} confirmDisabled={!organizationId || !role} onConfirm={() => add.mutate()}>
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
    </ConfirmDialog>
  );
}

function MembershipRow({ user, membership }: { user: AdminUserDetail; membership: AdminMembership }) {
  const t = useTranslations('admin.users');
  const tRoles = useTranslations('roles');
  const enumLabel = useEnumLabels();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const change = useMutation({
    mutationFn: (status: string) => updateMembership(membership.id, { status }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('membershipUpdated'));
      void queryClient.invalidateQueries({ queryKey: adminKeys.user(user.id) });
    },
    onError: (failure) => errorToast(failure),
  });
  const next = MEMBERSHIP_STATUSES.filter((status) => status !== membership.status);
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-subtle py-2.5 first:border-t-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{membership.organization?.name ?? '—'}</span>
        <span className="text-xs text-muted-foreground">{`${tRoles.has(membership.role) ? tRoles(membership.role) : membership.role} · ${enumLabel('context', membership.context)}`}</span>
      </span>
      <StatusBadge status={membership.status} tone={toneOf(REVIEW_STATUS_TONE, membership.status)} />
      <span className="flex gap-1">
        {next.map((status) => (
          <Button key={status} size="xs" variant="ghost" disabled={change.isPending} onClick={() => change.mutate(status)}>
            {t(`setStatus.${status}`)}
          </Button>
        ))}
      </span>
    </li>
  );
}

function UserView({ user }: { user: AdminUserDetail }) {
  const t = useTranslations('admin.users');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const suspended = user.status === UserStatus.Suspended;
  const status = useMutation({
    mutationFn: () => updateAdminUser(user.id, suspended ? UserStatus.Active : UserStatus.Suspended, user.version),
    meta: { handlesError: true },
    onSuccess: (next) => {
      queryClient.setQueryData(adminKeys.user(user.id), next);
      toast.success(t(suspended ? 'reactivated' : 'suspended'));
      setConfirming(false);
    },
    onError: (failure) => errorToast(failure),
  });
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.AdminHome} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={user.fullName ?? t('unnamed')}
        badge={<StatusBadge status={user.status} tone={toneOf(REVIEW_STATUS_TONE, user.status)} />}
        actions={
          <Button size="sm" variant={suspended ? 'default' : 'destructive'} onClick={() => setConfirming(true)}>
            {suspended ? t('reactivate') : t('suspend')}
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <Section
          title={t('memberships')}
          action={
            <Button size="xs" variant="outline" onClick={() => setAdding(true)}>
              <Icon name="add" size={14} />
              {t('addMembership')}
            </Button>
          }
        >
          {user.memberships.length === 0 ? <p className="text-sm text-muted-foreground">{t('noMemberships')}</p> : null}
          <ul className="flex flex-col">
            {user.memberships.map((membership) => (
              <MembershipRow key={membership.id} user={user} membership={membership} />
            ))}
          </ul>
        </Section>
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t('details')} delay={0.04}>
            <KeyValues
              columns={1}
              items={[
                { label: t('signup'), value: enumLabel('signupChannel', user.signupChannel) },
                { label: t('referralCode'), value: user.signupReferralCode ?? '—' },
                { label: t('created'), value: formatDateTime(user.createdAt, locale) },
                { label: t('lastLogin'), value: formatDateTime(user.lastLoginAt, locale) },
                { label: t('sessions'), value: String(user.activeSessions) },
              ]}
            />
          </Section>
          <Section title={t('logins')} delay={0.08}>
            <ul className="flex flex-col">
              {user.logins.map((login) => (
                <li key={login.id} className="flex flex-col border-t border-subtle py-2 first:border-t-0">
                  <span className="text-sm font-semibold text-foreground tabular">{login.identifier}</span>
                  <span className="text-xs text-muted-foreground">{`${enumLabel('loginMethod', login.method)} · ${formatRelative(login.lastUsedAt, locale)}`}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
      <AddMembership key={adding ? 'open' : 'closed'} user={user} open={adding} onOpenChange={setAdding} />
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title={suspended ? t('reactivateTitle') : t('suspendTitle')} description={suspended ? t('reactivateBody') : t('suspendBody')} confirmLabel={suspended ? t('reactivate') : t('suspend')} destructive={!suspended} pending={status.isPending} onConfirm={() => status.mutate()} />
    </div>
  );
}

export function AdminUserDetailScreen() {
  const t = useTranslations('admin.users');
  const { id } = useParams<{ id: string }>();
  const user = useQuery(adminUserQuery(id));
  if (user.isPending) return <ScreenSkeleton />;
  if (!user.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <UserView user={user.data} />;
}
