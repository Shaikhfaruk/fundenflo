'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { Section } from '@/components/data/detail-section';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { MobileInput } from '@/components/ui/mobile-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { usePartnerOwner } from '@/hooks/use-partner-owner';
import { invitePartnerMember, partnerKeys, partnerTeamQuery, updatePartnerMember } from '@/lib/api/partners';
import type { PartnerMember } from '@/lib/api/types/partner.types';
import { DEFAULT_COUNTRY_CODE, INDIAN_MOBILE_PATTERN } from '@/lib/constants/auth.constants';
import { MemberStatus } from '@/lib/constants/partner.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate, formatRelative } from '@/lib/format/date';

type Change = { member: PartnerMember; status: string };

export function PartnerTeam() {
  const t = useTranslations('partner.team');
  const roleLabel = useEnumLabel('partnerRole');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const { owner, membershipId } = usePartnerOwner();
  const team = useQuery(partnerTeamQuery());
  const [mobile, setMobile] = useState('');
  const [change, setChange] = useState<Change | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: partnerKeys.team() });
  const invite = useMutation({
    mutationFn: () => invitePartnerMember({ mobile, countryCode: DEFAULT_COUNTRY_CODE }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('invited'));
      setMobile('');
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const update = useMutation({
    mutationFn: ({ member, status }: Change) => updatePartnerMember(member.id, status),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('updated'));
      setChange(null);
      void refresh();
    },
    onError: (failure) => errorToast(failure),
  });
  const nameOf = (member: PartnerMember) => member.displayName ?? t('memberFallback', { id: member.userId.slice(-6) });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <Section title={t('members')}>
          {team.isPending ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : (
            <ul className="flex flex-col">
              {team.data?.members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-2 border-t border-subtle py-2.5 first:border-t-0">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {nameOf(member)}
                      {member.id === membershipId ? <span className="ml-1 text-xs font-normal text-muted-foreground">{t('you')}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{t('memberLine', { role: roleLabel(member.role), since: formatDate(member.approvedAt ?? member.createdAt, locale) })}</span>
                  </span>
                  <StatusBadge status={member.status} tone={toneOf(REVIEW_STATUS_TONE, member.status)} />
                  {owner && member.id !== membershipId && member.status !== MemberStatus.Revoked ? (
                    <span className="flex gap-1">
                      {member.status === MemberStatus.Active ? (
                        <Button size="xs" variant="outline" onClick={() => setChange({ member, status: MemberStatus.Suspended })}>
                          {t('suspend')}
                        </Button>
                      ) : (
                        <Button size="xs" variant="outline" onClick={() => setChange({ member, status: MemberStatus.Active })}>
                          {t('reactivate')}
                        </Button>
                      )}
                      <Button size="xs" variant="ghost" className="text-destructive" onClick={() => setChange({ member, status: MemberStatus.Revoked })}>
                        {t('remove')}
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="flex min-w-0 flex-col gap-4">
          {owner ? (
            <Section title={t('invite')} delay={0.04}>
              <Field>
                <FieldLabel htmlFor="member-mobile">{t('mobile')}</FieldLabel>
                <MobileInput id="member-mobile" value={mobile} onValueChange={setMobile} valid={INDIAN_MOBILE_PATTERN.test(mobile)} />
                <FieldDescription>{t('inviteHint')}</FieldDescription>
              </Field>
              <Button size="sm" className="self-start" disabled={!INDIAN_MOBILE_PATTERN.test(mobile) || invite.isPending} onClick={() => invite.mutate()}>
                {invite.isPending ? <Spinner /> : null}
                {t('send')}
              </Button>
            </Section>
          ) : null}
          <Section title={t('invitations')} delay={0.08}>
            {(team.data?.invitations.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noInvitations')}</p>
            ) : (
              <ul className="flex flex-col">
                {team.data?.invitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-2 border-t border-subtle py-2.5 first:border-t-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold text-foreground tabular">{invitation.recipient}</span>
                      <span className="text-xs text-muted-foreground">{t('expires', { when: formatRelative(invitation.expiresAt, locale) })}</span>
                    </span>
                    <StatusBadge status={invitation.status} tone={toneOf(REVIEW_STATUS_TONE, invitation.status)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
      <ConfirmDialog
        open={change !== null}
        onOpenChange={(open) => (open ? null : setChange(null))}
        title={change ? t(`confirm.${change.status}`, { name: nameOf(change.member) }) : ''}
        description={change ? t(`confirmBody.${change.status}`) : undefined}
        confirmLabel={change ? t(`action.${change.status}`) : ''}
        destructive={change?.status === MemberStatus.Revoked}
        pending={update.isPending}
        onConfirm={() => (change ? update.mutate(change) : null)}
      />
    </div>
  );
}
