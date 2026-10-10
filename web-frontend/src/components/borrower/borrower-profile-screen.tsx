'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { PanCard } from '@/components/borrower/pan-card';
import { EmptyState } from '@/components/data/empty-state';
import { FadeIn } from '@/components/motion/fade-in';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link } from '@/i18n/navigation';
import { borrowerKeys, borrowerProfileQuery, borrowerProfilesQuery, updateBorrowerProfile } from '@/lib/api/borrowers';
import { segmentsQuery } from '@/lib/api/catalog';
import type { BorrowerProfile } from '@/lib/api/types/borrower.types';
import { BUSINESS_SEGMENT } from '@/lib/constants/journey.constants';
import { NAME_MIN_LENGTH } from '@/lib/constants/kyc.constants';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { todayIsoDate } from '@/lib/format/date';

const rise = (delay: number) => ({ initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: Duration.Slow, ease: EASE_OUT } }) as const;

function BusinessDetails({ profile }: { profile: BorrowerProfile }) {
  const t = useTranslations('borrower.profile');
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const segments = useQuery(segmentsQuery());
  const subSegments = segments.data?.items.find((segment) => segment.key === profile.segmentKey)?.subSegments ?? [];
  const [name, setName] = useState(profile.party.displayName ?? '');
  const [subSegment, setSubSegment] = useState<string | null>(profile.subSegmentKey);
  const [incorporatedOn, setIncorporatedOn] = useState(profile.incorporatedOn ?? '');
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== (profile.party.displayName ?? '') || subSegment !== profile.subSegmentKey || (incorporatedOn || null) !== profile.incorporatedOn;
  const save = useMutation({
    mutationFn: () =>
      updateBorrowerProfile(
        profile.id,
        {
          ...(name.trim() !== (profile.party.displayName ?? '') ? { businessName: name.trim() } : {}),
          ...(subSegment !== profile.subSegmentKey ? { subSegment } : {}),
          ...((incorporatedOn || null) !== profile.incorporatedOn ? { incorporatedOn: incorporatedOn || null } : {}),
        },
        profile.version,
      ),
    meta: { handlesError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: borrowerKeys.all });
      toast.success(t('saved'));
      setError(null);
    },
    onError: (failure) => setError(errorText(failure)),
  });
  return (
    <motion.section {...rise(0.06)} className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card">
      <h2 className="font-heading text-lg font-semibold text-navy">{t('businessTitle')}</h2>
      <Field>
        <FieldLabel htmlFor="business-name">{t('businessName')}</FieldLabel>
        <Input id="business-name" autoComplete="organization" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      {subSegments.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{t('businessType')}</p>
          <div className="flex flex-wrap gap-2">
            {subSegments.map((item) => (
              <ChoiceChip key={item.key} selected={subSegment === item.key} label={item.label} onToggle={() => setSubSegment(item.key)} />
            ))}
          </div>
        </div>
      ) : null}
      <Field>
        <FieldLabel htmlFor="incorporated-on">{t('incorporatedOn')}</FieldLabel>
        <Input id="incorporated-on" type="date" max={todayIsoDate()} value={incorporatedOn} onChange={(event) => setIncorporatedOn(event.target.value)} />
        <FieldDescription>{t('incorporatedHint')}</FieldDescription>
      </Field>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button size="sm" className="self-start" disabled={!dirty || name.trim().length < NAME_MIN_LENGTH || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Spinner /> : null}
        {t('save')}
      </Button>
    </motion.section>
  );
}

function ProfileDetail({ id }: { id: string }) {
  const t = useTranslations('borrower.profile');
  const segments = useQuery(segmentsQuery());
  const profile = useQuery(borrowerProfileQuery(id));
  if (!profile.data) return <Skeleton className="h-96 rounded-xl" />;
  const data = profile.data;
  const segment = segments.data?.items.find((item) => item.key === data.segmentKey);
  const subSegment = segment?.subSegments.find((item) => item.key === data.subSegmentKey);
  const business = data.segmentKey === BUSINESS_SEGMENT;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <FadeIn className="relative isolate flex items-center gap-4 overflow-hidden rounded-xl bg-navy p-4 text-white shadow-lift">
          <span className="absolute -top-16 -right-10 -z-10 size-44 rounded-full bg-[#1b365d] opacity-60 glow" aria-hidden="true" />
          <IconTile icon={business ? 'business' : 'person'} tone="glass" size="lg" />
          <div className="flex min-w-0 flex-col">
            <p className="truncate font-heading text-lg font-semibold">{data.party.displayName ?? t('unnamed')}</p>
            <p className="truncate text-[13px] text-[#9aabc4]">{[segment?.label, subSegment?.label].filter(Boolean).join(' · ')}</p>
          </div>
        </FadeIn>
        {business ? <BusinessDetails key={data.version} profile={data} /> : null}
        <Link href={AppPath.Account} className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-card transition-transform active:scale-[0.99]">
          <IconTile icon="account" tone="subtle" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-navy">{t('accountTitle')}</span>
            <span className="truncate text-xs text-muted-foreground">{t('accountBody')}</span>
          </span>
          <Icon name="chevron-right" size={18} className="text-muted-foreground" />
        </Link>
      </div>
      <PanCard key={`${data.id}-${data.kyc?.pan?.verified ? 'v' : 'n'}`} profile={data} />
    </div>
  );
}

export function BorrowerProfileScreen() {
  const t = useTranslations('borrower.profile');
  const profiles = useQuery(borrowerProfilesQuery());
  const [chosen, setChosen] = useState<string | null>(null);
  const items = profiles.data?.items ?? [];
  const selected = chosen ?? items[0]?.id ?? null;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      {profiles.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState icon="person" title={t('emptyTitle')} body={t('emptyBody')} action={<ButtonLink href={AppPath.BorrowerNewApplication}>{t('emptyCta')}</ButtonLink>} />
      ) : (
        <>
          {items.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <ChoiceChip key={item.id} selected={item.id === selected} label={item.party.displayName ?? t('unnamed')} onToggle={() => setChosen(item.id)} />
              ))}
            </div>
          ) : null}
          {selected ? <ProfileDetail key={selected} id={selected} /> : null}
        </>
      )}
    </div>
  );
}
