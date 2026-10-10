'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useJourneyPaths, usePartnerMode } from '@/components/journey/journey-mode';
import { ConsentOtpSheet, type ConsentOtpTarget } from '@/components/consent/consent-otp-sheet';
import { JourneyPage } from '@/components/journey/journey-page';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { SecureNote } from '@/components/ui/secure-note';
import { Spinner } from '@/components/ui/spinner';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { applicationKeys, partyName } from '@/lib/api/applications';
import { applicationQuery } from '@/lib/api/journey';
import { latestMatchesQuery, matchKeys, runMatches } from '@/lib/api/matches';
import { confirmBorrowerConsent, sendBorrowerConsent } from '@/lib/api/partners';
import { requestSubmission, submissionsQuery } from '@/lib/api/submissions';
import type { MatchItem } from '@/lib/api/types/match.types';
import type { LenderSubmission } from '@/lib/api/types/submission.types';
import { ConsentPurpose } from '@/lib/constants/consent.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import { JOURNEY_SCREEN_STEP, JourneyScreen, MatchOutcome } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { CLOSED_SUBMISSION_STATUSES } from '@/lib/constants/status.constants';
import { cn } from '@/lib/utils';

const initialOf = (name: string | null) => (name?.trim().charAt(0) ?? '?').toUpperCase();

type CardProps = { item: MatchItem; index: number; selected: boolean; open: boolean; applied: LenderSubmission | undefined; applicationId: string; onSelect: () => void; onToggle: () => void };

function LenderCard({ item, index, selected, open, applied, applicationId, onSelect, onToggle }: CardProps) {
  const paths = useJourneyPaths();
  const t = useTranslations('flow.lenders');
  const eligible = item.outcome === MatchOutcome.Eligible;
  const selectable = eligible && !applied;
  return (
    <motion.article
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.07 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }}
      className={cn('rounded-xl border-[1.5px] border-transparent bg-card p-4 shadow-card transition-colors', selected && 'border-navy')}
    >
      <button type="button" aria-pressed={selected} disabled={!selectable} onClick={onSelect} className="flex w-full flex-col gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-default">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-base font-semibold text-white">{initialOf(item.lender.name)}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-heading text-base leading-[22px] font-semibold text-navy">{item.lender.name ?? t('lender')}</span>
            <span className="truncate text-[13px] text-muted-foreground">{item.product.name}</span>
          </span>
          {applied ? (
            <span className="rounded-full bg-info-soft px-2 py-1 text-[11px] font-semibold text-info">{t('applied')}</span>
          ) : eligible ? (
            <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[11px] font-semibold text-success">
              <Icon name="verified" size={14} />
              {t('verified')}
            </span>
          ) : null}
          {selected ? (
            <span className="flex size-[22px] items-center justify-center rounded-full bg-gold text-navy">
              <Icon name="check" size={14} />
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-muted-foreground">{t('fit')}</span>
          <span className="font-semibold text-navy tabular">{t('fitValue', { fit: item.fit })}</span>
        </div>
        {item.documentsNeeded.length > 0 ? (
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Icon name="document" size={14} />
            {t('documentsNeeded', { count: item.documentsNeeded.length })}
          </span>
        ) : null}
      </button>
      {item.reasons.length > 0 ? (
        <>
          <button type="button" aria-expanded={open} onClick={onToggle} className="mt-2 flex min-h-11 w-full items-center justify-between border-t border-subtle pt-2 text-sm font-semibold text-navy">
            {t('why')}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: Duration.Fast }}>
              <Icon name="expand-more" size={18} className="text-muted-foreground" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-2 overflow-hidden">
                {item.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm/5 text-foreground">
                    <Icon name="check-circle" size={16} className="mt-0.5 text-success" />
                    {reason}
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
      {applied ? (
        <Link href={paths.submission(applicationId, applied.id)} className="mt-2 flex items-center gap-1 text-sm font-semibold text-gold-ink">
          {t('viewStatus')}
          <Icon name="arrow-forward" size={14} />
        </Link>
      ) : null}
    </motion.article>
  );
}

export function LendersScreen() {
  const paths = useJourneyPaths();
  const t = useTranslations('flow.lenders');
  const partner = usePartnerMode();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const matches = useQuery(latestMatchesQuery(id));
  const submissions = useQuery(submissionsQuery(id));
  const [chosen, setChosen] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<(ConsentOtpTarget & { item: MatchItem }) | null>(null);
  const application = useQuery({ ...applicationQuery(id), enabled: partner });
  const borrowerName = application.data?.actingParty.displayName ?? (application.data ? partyName(application.data) : null) ?? t('borrower');
  const find = useMutation({
    mutationFn: () => runMatches(id),
    meta: { handlesError: true },
    onSuccess: (run) => queryClient.setQueryData(matchKeys.latest(id), run),
  });
  const { mutate: findLenders, isIdle } = find;
  const missing = matches.data === null;
  useEffect(() => {
    if (missing && isIdle) findLenders();
  }, [missing, isIdle, findLenders]);
  const openSubmissions = (submissions.data?.items ?? []).filter((submission) => !CLOSED_SUBMISSION_STATUSES.includes(submission.status));
  const appliedFor = (item: MatchItem) => openSubmissions.find((submission) => submission.product.id === item.product.id);
  const items = matches.data?.items ?? [];
  const eligible = items.filter((item) => item.outcome === MatchOutcome.Eligible);
  const almost = items.filter((item) => item.outcome !== MatchOutcome.Eligible);
  const selectable = eligible.filter((item) => !appliedFor(item));
  const selected = selectable.find((item) => item.id === chosen) ?? selectable[0];
  const expanded = openId === undefined ? (selected?.id ?? null) : openId;
  const apply = useMutation({
    mutationFn: (item: MatchItem) => requestSubmission(id, partner ? { matchResultId: item.id } : { matchResultId: item.id, shareWithLender: true }),
    meta: { handlesError: true },
    onSuccess: (submission) => {
      toast.success(t('sent', { lender: submission.lender.name ?? t('lender') }));
      void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      router.push(paths.submission(id, submission.id));
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.fieldIssues.some((issue) => issue.code === 'stale_match')) {
        setError(t('stale'));
        void queryClient.invalidateQueries({ queryKey: matchKeys.latest(id) });
        return;
      }
      setError(failure instanceof ApiError && failure.code === ErrorCode.Conflict ? t('alreadyApplied') : errorText(failure));
    },
  });
  const askConsent = useMutation({
    mutationFn: (item: MatchItem) => sendBorrowerConsent(id).then((challenge) => ({ item, challenge })),
    meta: { handlesError: true },
    onSuccess: ({ item, challenge }) => setConsent({ item, name: borrowerName, challenge, grant: [{ purpose: ConsentPurpose.LenderSharing, granted: true, organizationIds: item.lender.organizationId ? [item.lender.organizationId] : [] }] }),
    onError: (failure) => setError(errorText(failure)),
  });
  const start = (item: MatchItem) => {
    setError(null);
    if (partner) askConsent.mutate(item);
    else apply.mutate(item);
  };
  if (matches.isPending || (missing && (find.isPending || isIdle))) {
    return (
      <JourneyPage applicationId={id} step={JOURNEY_SCREEN_STEP[JourneyScreen.Lenders]} title={t('title')} description={t('description')}>
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground" aria-busy="true">
          <Spinner className="size-6 text-gold" />
          {t('finding')}
        </div>
      </JourneyPage>
    );
  }
  if (missing) {
    return (
      <JourneyPage applicationId={id} step={JOURNEY_SCREEN_STEP[JourneyScreen.Lenders]} title={t('title')} description={t('description')}>
        <section className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-card">
          <h2 className="font-heading text-lg font-semibold text-navy">{t('scoreFirstTitle')}</h2>
          <p className="text-sm text-muted-foreground">{find.error ? errorText(find.error) : t('scoreFirstBody')}</p>
          <ButtonLink href={paths.step(id, JourneyScreen.Score)} size="sm" className="mt-2 self-start">
            {t('toScore')}
          </ButtonLink>
        </section>
      </JourneyPage>
    );
  }
  return (
    <JourneyPage applicationId={id} step={JOURNEY_SCREEN_STEP[JourneyScreen.Lenders]} title={t('title')} description={t('description')}>
      {eligible.length === 0 ? (
        <section className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-card">
          <h2 className="font-heading text-lg font-semibold text-navy">{t('emptyTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
          <Link href={paths.step(id, JourneyScreen.Improve)} className="mt-1 text-sm font-semibold text-gold-ink">
            {t('seeImprove')}
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-3.5">
          {eligible.map((item, index) => (
            <LenderCard
              key={item.id}
              item={item}
              index={index}
              applicationId={id}
              applied={appliedFor(item)}
              selected={item.id === selected?.id}
              open={item.id === expanded}
              onSelect={() => {
                setChosen(item.id);
                setOpenId(item.id);
                setError(null);
              }}
              onToggle={() => setOpenId(expanded === item.id ? null : item.id)}
            />
          ))}
        </div>
      )}
      {almost.length > 0 ? (
        <section className="mt-4 flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold tracking-[0.04em] text-muted-foreground">{t('almostTitle')}</h2>
          {almost.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-card">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle font-heading text-sm font-semibold text-navy">{initialOf(item.lender.name)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-navy">{item.lender.name ?? t('lender')}</span>
                <span className="truncate text-xs text-muted-foreground">{item.documentsNeeded.length > 0 ? t('documentsNeeded', { count: item.documentsNeeded.length }) : t('moreDetails')}</span>
              </span>
              <Link href={paths.step(id, JourneyScreen.Documents)} className="text-xs font-semibold text-gold-ink">
                {t('addDocuments')}
              </Link>
            </div>
          ))}
        </section>
      ) : null}
      {items.length > 0 ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Icon name="lock" size={14} />
          {t('decision')}
        </p>
      ) : null}
      <div className="min-h-4 flex-1" />
      <div className="flex flex-col gap-2 pt-4">
        {selected ? <p className="text-center text-xs/[18px] text-muted-foreground">{partner ? t('partnerShareNote', { lender: selected.lender.name ?? t('lender'), name: borrowerName }) : t('shareNote', { lender: selected.lender.name ?? t('lender') })}</p> : null}
        {error ? (
          <p className="flex items-center gap-1.5 rounded-sm bg-error-soft px-3 py-2 text-xs text-destructive" role="alert">
            <Icon name="error" size={15} />
            {error}
          </p>
        ) : null}
        {selected ? (
          <Button className="w-full" disabled={apply.isPending || askConsent.isPending || (partner && !selected.lender.organizationId)} onClick={() => start(selected)}>
            {apply.isPending || askConsent.isPending ? <Spinner /> : null}
            {partner ? t('partnerApply', { lender: selected.lender.name ?? t('lender') }) : t('apply', { lender: selected.lender.name ?? t('lender') })}
            {apply.isPending || askConsent.isPending ? null : <Icon name="arrow-forward" size={18} />}
          </Button>
        ) : openSubmissions.length > 0 ? (
          <ButtonLink href={paths.step(id, JourneyScreen.Submissions)} className="w-full">
            {t('trackApplications')}
            <Icon name="arrow-forward" size={18} />
          </ButtonLink>
        ) : null}
        <SecureNote>{t('private')}</SecureNote>
      </div>
      <ConsentOtpSheet
        target={consent}
        resending={askConsent.isPending}
        onResend={() => (consent ? askConsent.mutate(consent.item) : undefined)}
        onOpenChange={(open) => (open ? undefined : setConsent(null))}
        confirm={(body) => confirmBorrowerConsent(id, body)}
        onConfirmed={() => (consent ? apply.mutate(consent.item) : undefined)}
      />
    </JourneyPage>
  );
}
