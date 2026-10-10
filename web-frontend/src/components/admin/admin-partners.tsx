'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { KeyValues } from '@/components/data/detail-section';
import { DetailSheet } from '@/components/data/detail-sheet';
import { EmptyState } from '@/components/data/empty-state';
import { ANY_VALUE, anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import type { Column } from '@/components/data/responsive-list';
import { SearchInput } from '@/components/data/search-input';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabels } from '@/hooks/use-enum-label';
import { adminKeys, adminPartnerQuery, reinstatePartner, setPartnerLevel, suspendPartner, verifyPartner } from '@/lib/api/admin';
import { pagedQuery } from '@/lib/api/paged';
import type { PartnerProfile } from '@/lib/api/types/partner.types';
import { PARTNER_LEVELS, PARTNER_NOTE_MIN_LENGTH, PARTNER_VERIFICATION_STATUSES, VerificationDecision } from '@/lib/constants/admin.constants';
import { MIN_SEARCH_LENGTH } from '@/lib/constants/lead.constants';
import { PartnerVerificationStatus } from '@/lib/constants/partner.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime } from '@/lib/format/date';

const NOTE_MAX_LENGTH = 1_000;

const DECIDABLE: readonly string[] = [PartnerVerificationStatus.Pending, PartnerVerificationStatus.InReview];

type Action = 'approve' | 'reject' | 'level' | 'suspend' | 'reinstate';

const partnersQuery = (filter: { verificationStatus?: string; q?: string }) => pagedQuery<PartnerProfile>([...adminKeys.all, 'partners', filter], 'GET /admin/partners', filter);

function PartnerSheet({ row, onClose }: { row: PartnerProfile; onClose: () => void }) {
  const t = useTranslations('admin.partners');
  const fresh = useQuery(adminPartnerQuery(row.id));
  const partner = fresh.data ?? row;
  const tKinds = useTranslations('partner.signup.kinds');
  const enumLabel = useEnumLabels();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const [action, setAction] = useState<Action | null>(null);
  const run = useMutation({
    mutationFn: ({ kind, note, choice }: { kind: Action; note: string; choice: string | null }) => {
      if (kind === 'approve' || kind === 'reject') return verifyPartner(partner.id, { decision: kind === 'approve' ? VerificationDecision.Approve : VerificationDecision.Reject, note });
      if (kind === 'level') return setPartnerLevel(partner.id, { level: choice ?? partner.level, note });
      if (kind === 'suspend') return suspendPartner(partner.id, note);
      return reinstatePartner(partner.id, note);
    },
    meta: { handlesError: true },
    onSuccess: (_, { kind }) => {
      toast.success(t(`done.${kind}`));
      setAction(null);
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'partners'] });
      onClose();
    },
    onError: (failure) => errorToast(failure),
  });
  const decidable = DECIDABLE.includes(partner.verification.status);
  const active = partner.organizationStatus === 'active';
  return (
    <DetailSheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={partner.name}
      description={tKinds.has(partner.kind) ? tKinds(partner.kind) : partner.kind}
      footer={
        <>
          {decidable ? (
            <>
              <Button size="sm" onClick={() => setAction('approve')}>
                {partner.verification.recommendedDecision ? t('decideApprove') : t('recommendApprove')}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setAction('reject')}>
                {t('reject')}
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setAction('level')}>
            {t('level')}
          </Button>
          {active ? (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAction('suspend')}>
              {t('suspend')}
            </Button>
          ) : partner.verification.status === PartnerVerificationStatus.Verified ? (
            <Button size="sm" variant="ghost" onClick={() => setAction('reinstate')}>
              {t('reinstate')}
            </Button>
          ) : null}
        </>
      }
    >
      <KeyValues
        columns={1}
        items={[
          { label: t('verification'), value: <StatusBadge status={partner.verification.status} tone={toneOf(REVIEW_STATUS_TONE, partner.verification.status)} /> },
          { label: t('recommendation'), value: partner.verification.recommendedDecision ? `${enumLabel('verificationDecision', partner.verification.recommendedDecision)} · ${partner.verification.recommendationNote ?? ''}` : '—' },
          { label: t('organization'), value: <StatusBadge status={partner.organizationStatus} tone={toneOf(REVIEW_STATUS_TONE, partner.organizationStatus)} /> },
          { label: t('levelLabel'), value: enumLabel('partnerLevel', partner.level) },
          { label: t('membership'), value: partner.membershipNumber ?? '—' },
          { label: t('kyc'), value: enumLabel('kycStatus', partner.kyc.status) },
          { label: t('areas'), value: partner.serviceAreas.map((area) => area.state?.name ?? area.city?.name ?? area.pincode ?? '').filter(Boolean).join(', ') || '—' },
          { label: t('capacity'), value: partner.capacity.paused ? t('paused') : partner.capacity.maxOpenLeads === null ? t('noLimit') : t('maxOpen', { count: partner.capacity.maxOpenLeads }) },
          { label: t('joined'), value: formatDateTime(partner.createdAt, locale) },
        ]}
      />
      <p className="text-xs text-muted-foreground">{t('makerChecker')}</p>
      <ReasonDialog
        key={action ?? 'none'}
        open={action !== null}
        onOpenChange={(open) => (open ? null : setAction(null))}
        title={action ? t(`titles.${action}`) : ''}
        label={t('note')}
        confirmLabel={action ? t(`confirm.${action}`) : ''}
        destructive={action === 'reject' || action === 'suspend'}
        pending={run.isPending}
        minLength={PARTNER_NOTE_MIN_LENGTH}
        maxLength={NOTE_MAX_LENGTH}
        options={action === 'level' ? PARTNER_LEVELS.map((value) => ({ value, label: enumLabel('partnerLevel', value) })) : undefined}
        optionsLabel={action === 'level' ? t('levelLabel') : undefined}
        onConfirm={(note, choice) => (action ? run.mutate({ kind: action, note, choice }) : null)}
      />
    </DetailSheet>
  );
}

export function AdminPartners() {
  const t = useTranslations('admin.partners');
  const enumLabel = useEnumLabels();
  const [status, setStatus] = useState<string>(ANY_VALUE);
  const [q, setQ] = useState('');
  const [opened, setOpened] = useState<PartnerProfile | null>(null);
  const partners = useInfiniteQuery(partnersQuery({ verificationStatus: anyToUndefined(status), q: q.trim().length >= MIN_SEARCH_LENGTH ? q.trim() : undefined }));
  const title = (row: PartnerProfile) => (
    <button type="button" onClick={() => setOpened(row)} className="truncate text-left font-semibold text-navy hover:underline">
      {row.name}
    </button>
  );
  const columns: Column<PartnerProfile>[] = [
    { key: 'name', header: t('name'), cell: title, hideOnCard: true },
    { key: 'kind', header: t('kind'), cell: (row) => enumLabel('partnerKind', row.kind) },
    { key: 'level', header: t('levelLabel'), cell: (row) => enumLabel('partnerLevel', row.level) },
    { key: 'verification', header: t('verification'), cell: (row) => <StatusBadge status={row.verification.status} tone={toneOf(REVIEW_STATUS_TONE, row.verification.status)} /> },
    { key: 'organization', header: t('organization'), cell: (row) => <StatusBadge status={row.organizationStatus} tone={toneOf(REVIEW_STATUS_TONE, row.organizationStatus)} /> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void partners.refetch()} refreshing={partners.isFetching}>
        <SearchInput value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('search')} aria-label={t('search')} className="sm:w-64" />
        <EnumSelect value={status} onChange={setStatus} values={PARTNER_VERIFICATION_STATUSES} label={t('verification')} allLabel={t('anyStatus')} labelOf={(value) => enumLabel('verificationStatus', value)} />
      </FilterBar>
      <PagedList result={partners} columns={columns} rowKey={(row) => row.id} title={title} empty={<EmptyState icon="handshake" title={t('emptyTitle')} body={t('emptyBody')} />} />
      {opened ? <PartnerSheet key={opened.id} row={opened} onClose={() => setOpened(null)} /> : null}
    </div>
  );
}
