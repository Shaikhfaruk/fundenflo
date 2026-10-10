'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { useJourneyPaths, usePartnerMode } from '@/components/journey/journey-mode';
import { ConsentOtpSheet, type ConsentOtpTarget } from '@/components/consent/consent-otp-sheet';
import { JourneyFooter } from '@/components/journey/journey-footer';
import { JourneyPage } from '@/components/journey/journey-page';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { Icon } from '@/components/ui/icon';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import { applicationKeys, partyName } from '@/lib/api/applications';
import { consentKeys, consentTemplateQuery, myConsentsQuery } from '@/lib/api/consents';
import { applicationQuery, recordApplicationConsent } from '@/lib/api/journey';
import { confirmBorrowerConsent, sendBorrowerConsent } from '@/lib/api/partners';
import type { ConsentState, ConsentTemplate } from '@/lib/api/types/consent.types';
import { JOURNEY_CONSENT_CONTEXT, JOURNEY_SCREEN_STEP, JourneyScreen } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { AppPath } from '@/lib/constants/routes.constants';

type FormProps = { applicationId: string; template: ConsentTemplate; current: ConsentState[]; borrowerName: string };

function ConsentsForm({ applicationId, template, current, borrowerName }: FormProps) {
  const paths = useJourneyPaths();
  const t = useTranslations('flow.consents');
  const partner = usePartnerMode();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const decided = new Map(current.filter((state) => state.lastRecordId !== null).map((state) => [state.purpose, state.granted]));
  const [choices, setChoices] = useState<Record<string, boolean>>(() => Object.fromEntries(template.items.map((item) => [item.purpose, decided.get(item.purpose) ?? item.required])));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<ConsentOtpTarget | null>(null);
  const missing = template.items.filter((item) => item.required && !choices[item.purpose]);
  const items = template.items.map((item) => ({ purpose: item.purpose, granted: choices[item.purpose] ?? false }));
  const finish = (missingRequired: string[]) => {
    void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    if (missingRequired.length > 0) {
      setError(t('missing'));
      return;
    }
    toast.success(partner ? t('partner.saved', { name: borrowerName }) : t('saved'));
    router.push(paths.application(applicationId));
  };
  const save = useMutation({
    mutationFn: () => recordApplicationConsent(applicationId, { templateVersionId: template.versionId, items }),
    meta: { handlesError: true },
    onSuccess: (result) => {
      queryClient.setQueryData(applicationKeys.detail(applicationId), result.application);
      void queryClient.invalidateQueries({ queryKey: consentKeys.mine() });
      finish(result.missingRequired);
    },
    onError: (failure) => setError(errorText(failure)),
  });
  const send = useMutation({
    mutationFn: () => sendBorrowerConsent(applicationId),
    meta: { handlesError: true },
    onSuccess: (challenge) => setTarget({ name: borrowerName, challenge, grant: items }),
    onError: (failure) => setError(errorText(failure)),
  });
  return (
    <JourneyPage
      applicationId={applicationId}
      step={JOURNEY_SCREEN_STEP[JourneyScreen.Consents]}
      icon={
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="flex size-12 items-center justify-center rounded-xl bg-gold-soft text-navy" aria-hidden="true">
          <Icon name="shield" size={24} />
        </motion.span>
      }
      title={partner ? t('partner.title') : t('title')}
      description={partner ? t('partner.description', { name: borrowerName }) : t('description')}
    >
      <div className="flex flex-col gap-2.5">
        {template.items.map((item, index) => (
          <motion.div key={item.purpose} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }}>
            <ToggleRow title={item.title} description={item.summary} checked={choices[item.purpose] ?? false} onCheckedChange={(checked) => setChoices((state) => ({ ...state, [item.purpose]: checked }))} disabled={save.isPending} />
          </motion.div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 px-1 text-xs/[18px] text-muted-foreground">
        <Icon name="info" size={15} className="mt-px" />
        <span>{partner ? t('partner.withdrawAnytime', { name: borrowerName }) : t.rich('withdrawAnytime', { link: (chunks) => <Link href={AppPath.AccountConsents} className="font-semibold text-navy underline-offset-4 hover:underline">{chunks}</Link> })}</span>
      </p>
      <button type="button" onClick={() => setDetailsOpen(true)} className="mt-2 flex items-center gap-1 self-start px-1 text-sm font-semibold text-gold-ink">
        {t('readDetails')}
        <Icon name="arrow-forward" size={14} />
      </button>
      <div className="min-h-4 flex-1" />
      <JourneyFooter
        label={partner ? t('partner.send', { name: borrowerName }) : t('agree')}
        onContinue={() => {
          setError(null);
          if (partner) send.mutate();
          else save.mutate();
        }}
        disabled={missing.length > 0}
        pending={save.isPending || send.isPending}
        hint={t('hint')}
        error={error}
        note={t('secure')}
      />
      <ConsentOtpSheet
        target={target}
        resending={send.isPending}
        onResend={() => send.mutate()}
        onOpenChange={(open) => (open ? undefined : setTarget(null))}
        confirm={(body) => confirmBorrowerConsent(applicationId, body)}
        onConfirmed={(result) => finish(result.missingRequired)}
      />
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] w-full max-w-[560px] gap-4 overflow-y-auto px-4 pt-4 pb-4 safe-bottom">
          <SheetHeader className="p-0">
            <SheetTitle className="font-heading text-lg font-semibold text-navy">{t('detailsTitle')}</SheetTitle>
          </SheetHeader>
          {template.items.map((item) => (
            <section key={item.purpose} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-navy">{item.title}</h3>
              <p className="text-[13px]/5 text-muted-foreground">{item.details}</p>
            </section>
          ))}
          {template.policyUrl ? (
            <a href={template.policyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-gold-ink">
              {t('policy')}
              <Icon name="arrow-outward" size={14} />
            </a>
          ) : null}
        </SheetContent>
      </Sheet>
    </JourneyPage>
  );
}

export function ConsentsScreen() {
  const t = useTranslations('flow.consents');
  const { id } = useParams<{ id: string }>();
  const partner = usePartnerMode();
  const template = useQuery(consentTemplateQuery(JOURNEY_CONSENT_CONTEXT));
  const mine = useQuery({ ...myConsentsQuery(), enabled: !partner });
  const application = useQuery(applicationQuery(id));
  if (template.isPending || (!partner && mine.isPending) || application.isPending) return <ScreenSkeleton />;
  if (!template.data) return <p className="mx-auto max-w-[560px] rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  const borrowerName = application.data?.actingParty.displayName ?? (application.data ? partyName(application.data) : null) ?? t('partner.borrower');
  return <ConsentsForm key={template.data.versionId} applicationId={id} template={template.data} current={partner ? [] : (mine.data?.items ?? [])} borrowerName={borrowerName} />;
}
