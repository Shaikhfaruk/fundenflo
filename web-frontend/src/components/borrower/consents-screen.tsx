'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { JourneyFooter } from '@/components/journey/journey-footer';
import { JourneyPage } from '@/components/journey/journey-page';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { Icon } from '@/components/ui/icon';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import { applicationKeys } from '@/lib/api/applications';
import { consentKeys, consentTemplateQuery, myConsentsQuery } from '@/lib/api/consents';
import { recordApplicationConsent } from '@/lib/api/journey';
import type { ConsentState, ConsentTemplate } from '@/lib/api/types/consent.types';
import { JOURNEY_CONSENT_CONTEXT, JOURNEY_SCREEN_STEP, JourneyScreen } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';

function ConsentsForm({ applicationId, template, current }: { applicationId: string; template: ConsentTemplate; current: ConsentState[] }) {
  const t = useTranslations('flow.consents');
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const decided = new Map(current.filter((state) => state.lastRecordId !== null).map((state) => [state.purpose, state.granted]));
  const [choices, setChoices] = useState<Record<string, boolean>>(() => Object.fromEntries(template.items.map((item) => [item.purpose, decided.get(item.purpose) ?? item.required])));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = template.items.filter((item) => item.required && !choices[item.purpose]);
  const save = useMutation({
    mutationFn: () => recordApplicationConsent(applicationId, { templateVersionId: template.versionId, items: template.items.map((item) => ({ purpose: item.purpose, granted: choices[item.purpose] ?? false })) }),
    meta: { handlesError: true },
    onSuccess: (result) => {
      queryClient.setQueryData(applicationKeys.detail(applicationId), result.application);
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      void queryClient.invalidateQueries({ queryKey: consentKeys.mine() });
      if (result.missingRequired.length > 0) {
        setError(t('missing'));
        return;
      }
      toast.success(t('saved'));
      router.push(RoutePath.application(applicationId));
    },
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
      title={t('title')}
      description={t('description')}
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
        <span>{t.rich('withdrawAnytime', { link: (chunks) => <Link href={AppPath.AccountConsents} className="font-semibold text-navy underline-offset-4 hover:underline">{chunks}</Link> })}</span>
      </p>
      <button type="button" onClick={() => setDetailsOpen(true)} className="mt-2 flex items-center gap-1 self-start px-1 text-sm font-semibold text-gold-deep">
        {t('readDetails')}
        <Icon name="arrow-forward" size={14} />
      </button>
      <div className="min-h-4 flex-1" />
      <JourneyFooter label={t('agree')} onContinue={() => save.mutate()} disabled={missing.length > 0} pending={save.isPending} hint={t('hint')} error={error} note={t('secure')} />
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
            <a href={template.policyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-gold-deep">
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
  const template = useQuery(consentTemplateQuery(JOURNEY_CONSENT_CONTEXT));
  const mine = useQuery(myConsentsQuery());
  if (template.isPending || mine.isPending) return <ScreenSkeleton />;
  if (!template.data) return <p className="mx-auto max-w-[560px] rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <ConsentsForm key={template.data.versionId} applicationId={id} template={template.data} current={mine.data?.items ?? []} />;
}
