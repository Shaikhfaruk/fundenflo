'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { type ConsentTarget, PartyConsentSheet } from '@/components/borrower/party-consent-sheet';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { JourneyFooter } from '@/components/journey/journey-footer';
import { JourneyPage } from '@/components/journey/journey-page';
import { Button } from '@/components/ui/button';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Input } from '@/components/ui/input';
import { MobileInput } from '@/components/ui/mobile-input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText, useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { applicationKeys } from '@/lib/api/applications';
import { addParty, journeyKeys, partiesQuery, removeParty, sendPartyConsent } from '@/lib/api/journey';
import type { ApplicationParty } from '@/lib/api/types/application.types';
import { DEFAULT_COUNTRY_CODE, INDIAN_MOBILE_PATTERN } from '@/lib/constants/auth.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import { CO_PARTY_ROLES, CoPartyRole, JOURNEY_SCREEN_STEP, JourneyScreen, PARTY_RELATIONSHIPS, PartyConsentStatus, PartyKind } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { StatusTone } from '@/lib/constants/status.constants';

const NAME_MIN_LENGTH = 2;

const CONSENT_TONE: Record<string, StatusTone> = {
  [PartyConsentStatus.Pending]: StatusTone.Warning,
  [PartyConsentStatus.Granted]: StatusTone.Success,
  [PartyConsentStatus.Declined]: StatusTone.Danger,
};

function AddPersonSheet({ applicationId, open, onOpenChange, onAdded }: { applicationId: string; open: boolean; onOpenChange: (open: boolean) => void; onAdded: (party: ApplicationParty) => void }) {
  const t = useTranslations('flow.people');
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<string>(CoPartyRole.CoApplicant);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [relationship, setRelationship] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length >= NAME_MIN_LENGTH && INDIAN_MOBILE_PATTERN.test(mobile);
  const add = useMutation({
    mutationFn: () => addParty(applicationId, { role, name: name.trim(), mobile, countryCode: DEFAULT_COUNTRY_CODE, relationship: relationship ?? undefined }),
    meta: { handlesError: true },
    onSuccess: (party) => {
      void queryClient.invalidateQueries({ queryKey: journeyKeys.parties(applicationId) });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      setName('');
      setMobile('');
      setRelationship(null);
      setError(null);
      onAdded(party);
    },
    onError: (failure) => setError(failure instanceof ApiError && failure.code === ErrorCode.Conflict ? t('alreadyAdded') : errorText(failure)),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] w-full max-w-[560px] gap-4 overflow-y-auto px-4 pt-4 pb-4 safe-bottom">
        <span className="mx-auto h-1 w-10 rounded-full bg-[#e7e8eb]" aria-hidden="true" />
        <SheetHeader className="p-0">
          <SheetTitle className="font-heading text-lg font-semibold text-navy">{t('addTitle')}</SheetTitle>
          <SheetDescription>{t('addBody')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t('role')}</p>
          <div className="grid grid-cols-3 gap-2">
            {CO_PARTY_ROLES.map((value) => (
              <ChoiceChip key={value} selected={role === value} label={t(`roles.${value}`)} onToggle={() => setRole(value)} className="justify-center px-2 text-[13px]" />
            ))}
          </div>
        </div>
        <Field>
          <FieldLabel htmlFor="party-name">{t('name')}</FieldLabel>
          <Input id="party-name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="party-mobile">{t('mobile')}</FieldLabel>
          <MobileInput id="party-mobile" value={mobile} onValueChange={setMobile} valid={INDIAN_MOBILE_PATTERN.test(mobile)} placeholder={t('mobilePlaceholder')} />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t('relationship')}</p>
          <div className="flex flex-wrap gap-2">
            {PARTY_RELATIONSHIPS.map((value) => (
              <ChoiceChip key={value} selected={relationship === value} label={t(`relationships.${value}`)} onToggle={() => setRelationship(relationship === value ? null : value)} className="min-h-10 text-[13px]" />
            ))}
          </div>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button className="w-full" disabled={!valid || add.isPending} onClick={() => add.mutate()}>
          {add.isPending ? <Spinner /> : <Icon name="add" size={18} />}
          {t('addConfirm')}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function PersonRow({ party, index, onConsent, onRemove, sending }: { party: ApplicationParty; index: number; onConsent: () => void; onRemove: () => void; sending: boolean }) {
  const t = useTranslations('flow.people');
  const granted = party.consentStatus === PartyConsentStatus.Granted;
  return (
    <motion.li layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ delay: index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-sm font-semibold text-white">{(party.party.displayName ?? '?').slice(0, 1).toUpperCase()}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-foreground">{party.party.displayName}</span>
          <span className="truncate text-xs text-muted-foreground tabular">{[t(`roles.${party.role}`), party.relationship ? t(`relationships.${party.relationship}`) : null, party.mobile].filter(Boolean).join(' · ')}</span>
        </div>
        <StatusBadge status={party.consentStatus} tone={CONSENT_TONE[party.consentStatus] ?? StatusTone.Neutral} namespace="flow.people.consentStatus" />
      </div>
      <div className="flex items-center gap-2">
        {granted ? (
          <p className="flex flex-1 items-center gap-1.5 text-xs font-semibold text-success">
            <Icon name="check-circle" size={16} />
            {t('consentDone')}
          </p>
        ) : (
          <Button size="sm" className="flex-1" onClick={onConsent} disabled={sending}>
            {sending ? <Spinner /> : <Icon name="sms" size={16} />}
            {t('getConsent')}
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label={t('remove', { name: party.party.displayName ?? '' })}>
          <Icon name="delete" size={18} />
        </Button>
      </div>
    </motion.li>
  );
}

export function PeopleScreen() {
  const t = useTranslations('flow.people');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toastError = useErrorToast();
  const parties = useQuery(partiesQuery(id));
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<ConsentTarget | null>(null);
  const [removing, setRemoving] = useState<ApplicationParty | null>(null);
  const send = useMutation({
    mutationFn: (party: ApplicationParty) => sendPartyConsent(id, party.id).then((challenge) => ({ party, challenge })),
    meta: { handlesError: true },
    onSuccess: (next) => setTarget(next),
    onError: (failure) => toastError(failure),
  });
  const remove = useMutation({
    mutationFn: (party: ApplicationParty) => removeParty(id, party.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: journeyKeys.parties(id) });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(id) });
      toast.success(t('removed'));
      setRemoving(null);
    },
  });
  const all = parties.data?.items ?? [];
  const others = all.filter((party) => CO_PARTY_ROLES.includes(party.role));
  const borrower = all.find((party) => !CO_PARTY_ROLES.includes(party.role) && party.party.kind === PartyKind.Business) ?? all.find((party) => !CO_PARTY_ROLES.includes(party.role));
  const pending = others.filter((party) => party.consentStatus !== PartyConsentStatus.Granted).length;
  return (
    <JourneyPage applicationId={id} step={JOURNEY_SCREEN_STEP[JourneyScreen.People]} eyebrow={t('eyebrow')} title={t('title')} description={t('description')}>
      {parties.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {borrower ? (
            <div className="flex items-center gap-3 rounded-xl bg-subtle p-3.5">
              <IconTile icon={borrower.party.kind === PartyKind.Business ? 'business' : 'person'} tone="card" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-navy">{borrower.party.displayName ?? t('you')}</span>
                <span className="text-xs text-muted-foreground">{t('mainBorrower')}</span>
              </div>
            </div>
          ) : null}
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {others.map((party, index) => (
                <PersonRow key={party.id} party={party} index={index} sending={send.isPending && send.variables?.id === party.id} onConsent={() => send.mutate(party)} onRemove={() => setRemoving(party)} />
              ))}
            </AnimatePresence>
          </ul>
          {others.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">{t('empty')}</p> : null}
          <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
            <Icon name="add" size={20} />
            {t('add')}
          </Button>
        </div>
      )}
      <div className="min-h-4 flex-1" />
      {pending > 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-gold-soft px-3 py-2.5 text-xs/[18px] text-[#5d4200]">
          <Icon name="info" size={16} className="shrink-0 text-gold-deep" />
          {t('pendingNote', { count: pending })}
        </p>
      ) : null}
      <JourneyFooter label={others.length === 0 ? t('skip') : t('continue')} onContinue={() => router.push(RoutePath.applicationStep(id, JourneyScreen.Consents))} note={t('secure')} />
      <AddPersonSheet
        applicationId={id}
        open={adding}
        onOpenChange={setAdding}
        onAdded={(party) => {
          setAdding(false);
          toast.success(t('added', { name: party.party.displayName ?? '' }));
        }}
      />
      <PartyConsentSheet applicationId={id} target={target} resending={send.isPending} onResend={(party) => send.mutate(party)} onOpenChange={(open) => (open ? undefined : setTarget(null))} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={t('removeTitle', { name: removing?.party.displayName ?? '' })}
        description={t('removeBody')}
        confirmLabel={t('removeConfirm')}
        destructive
        pending={remove.isPending}
        onConfirm={() => (removing ? remove.mutate(removing) : undefined)}
      />
    </JourneyPage>
  );
}
