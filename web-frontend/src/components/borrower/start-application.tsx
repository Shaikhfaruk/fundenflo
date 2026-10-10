'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { FadeIn } from '@/components/motion/fade-in';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { Button } from '@/components/ui/button';
import { ChoiceChip, ChoiceRow, ChoiceTile } from '@/components/ui/choice';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon, type IconName, isIconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SecureNote } from '@/components/ui/secure-note';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StepHeader } from '@/components/ui/step-header';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { applicationKeys, createApplication } from '@/lib/api/applications';
import { categoriesQuery, segmentsQuery } from '@/lib/api/catalog';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { formatPaise } from '@/lib/format/money';

const BPS_PER_PERCENT = 100;
const BUSINESS_SEGMENT = 'msme';
const START_STEPS = 2;
const SEGMENT_FALLBACK_ICON: IconName = 'person';
const CATEGORY_FALLBACK_ICON: IconName = 'payments';

const SWAP = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: Duration.Base, ease: EASE_OUT } } as const;

export function StartApplication() {
  const t = useTranslations('borrower.start');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toastError = useErrorToast();
  const [step, setStep] = useState(1);
  const [segment, setSegment] = useState<string | null>(null);
  const [subSegment, setSubSegment] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [fieldError, setFieldError] = useState<{ path: string; message: string } | null>(null);
  const segments = useQuery(segmentsQuery());
  const chosenSegment = segments.data?.items.find((item) => item.key === segment);
  const needsSubSegment = Boolean(chosenSegment?.subSegments.length);
  const segmentReady = Boolean(segment) && (!needsSubSegment || Boolean(subSegment));
  const categories = useQuery({ ...categoriesQuery({ segment: segment ?? undefined, subSegment: subSegment ?? undefined }), enabled: segmentReady });
  const create = useMutation({
    mutationFn: () => createApplication({ segment: segment ?? '', subSegment: subSegment ?? undefined, category: category ?? '', businessName: businessName.trim() || undefined }),
    meta: { handlesError: true },
    onSuccess: (application) => {
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success(t('created', { ref: application.ref }));
      router.replace(RoutePath.application(application.id));
    },
    onError: (error) => {
      const issue = error instanceof ApiError ? error.fieldIssues[0] : undefined;
      if (issue) setFieldError(issue);
      else toastError(error);
    },
  });
  const reasonText = (reason: string | null | undefined) => (reason && t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : reason);
  const available = categories.data?.items.filter((item) => item.availability?.available ?? true) ?? [];
  const ready = segmentReady && Boolean(category);
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col">
      <StepHeader step={step} total={START_STEPS} onBack={step > 1 ? () => setStep(1) : undefined} backHref={step === 1 ? AppPath.BorrowerHome : undefined} />
      <AnimatePresence mode="wait" initial={false}>
        {step === 1 ? (
          <motion.section key="who" {...SWAP} className="mt-4 flex flex-1 flex-col">
            <FadeIn>
              <h1 className="font-heading text-2xl leading-8 font-semibold tracking-[-0.01em] text-foreground">{t('segment')}</h1>
              <p className="mt-2 text-sm leading-[22px] text-muted-foreground">{t('segmentBody')}</p>
            </FadeIn>
            <Stagger delay={0.1} step={0.08} className="mt-4 flex flex-col gap-3">
              {segments.isPending
                ? [0, 1].map((key) => <Skeleton key={key} className="h-[88px] rounded-xl" />)
                : segments.data?.items.map((item) => (
                    <StaggerItem key={item.key}>
                      <ChoiceRow
                        selected={segment === item.key}
                        onSelect={() => {
                          setSegment(item.key);
                          setSubSegment(null);
                          setCategory(null);
                        }}
                        icon={isIconName(item.icon) ? item.icon : SEGMENT_FALLBACK_ICON}
                        title={item.label}
                        description={item.description}
                      />
                    </StaggerItem>
                  ))}
            </Stagger>
            <AnimatePresence initial={false}>
              {needsSubSegment ? (
                <motion.div key={segment} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: Duration.Base, ease: EASE_OUT }} className="overflow-hidden">
                  <p className="mt-4 mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{segment === BUSINESS_SEGMENT ? t('subSegment') : t('subSegmentIndividual')}</p>
                  <div className="flex flex-wrap gap-2">
                    {chosenSegment?.subSegments.map((item) => (
                      <ChoiceChip
                        key={item.key}
                        selected={subSegment === item.key}
                        label={item.label}
                        onToggle={() => {
                          setSubSegment(item.key);
                          setCategory(null);
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <p className="mt-4 flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Icon name="info" size={15} />
              {t('segmentHint')}
            </p>
            <div className="min-h-4 flex-1" />
            <Button className="mt-4 w-full" disabled={!segmentReady} onClick={() => setStep(2)}>
              {t('continue')}
              <Icon name="arrow-forward" size={18} />
            </Button>
            <SecureNote className="mt-3">{t('secure')}</SecureNote>
          </motion.section>
        ) : (
          <motion.section key="what" {...SWAP} className="mt-4 flex flex-1 flex-col">
            <FadeIn>
              <Eyebrow className="mb-2">{t('categoryEyebrow')}</Eyebrow>
              <h1 className="font-heading text-2xl leading-8 font-semibold tracking-[-0.01em] text-foreground">{t('category')}</h1>
              <p className="mt-2 text-sm leading-[22px] text-muted-foreground">{t('categoryBody')}</p>
            </FadeIn>
            {categories.isPending ? (
              <div className="mt-4 grid grid-cols-2 gap-3" aria-busy="true">
                {Array.from({ length: 6 }, (_, key) => (
                  <Skeleton key={key} className="h-[118px] rounded-xl" />
                ))}
              </div>
            ) : (
              <Stagger step={0.04} className="mt-4 grid grid-cols-2 gap-3">
                {categories.data?.items.map((item) => {
                  const open = item.availability?.available ?? true;
                  return (
                    <StaggerItem key={item.key}>
                      <ChoiceTile
                        selected={category === item.key}
                        disabled={!open}
                        onSelect={() => setCategory(item.key)}
                        icon={isIconName(item.icon) ? item.icon : CATEGORY_FALLBACK_ICON}
                        title={item.label}
                        description={open ? `${t('range', { min: formatPaise(item.minAmountPaise, locale, true), max: formatPaise(item.maxAmountPaise, locale, true) })}${item.illustrativeRateBps ? ` · ${t('rate', { rate: item.illustrativeRateBps / BPS_PER_PERCENT })}` : ''}` : reasonText(item.availability?.reason)}
                        badge={<span className="rounded-xs bg-[#e6ebf1] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{t('unavailable')}</span>}
                        className="h-full"
                      />
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}
            {categories.data ? (
              <p className="mt-4 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Icon name="info" size={15} />
                {available.length === 0 ? t('noneAvailable') : t('categoryHint')}
              </p>
            ) : null}
            <AnimatePresence initial={false}>
              {segment === BUSINESS_SEGMENT && category ? (
                <motion.div key="business" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Field data-invalid={fieldError?.path === 'businessName'} className="mt-4">
                    <FieldLabel htmlFor="businessName">{t('businessName')}</FieldLabel>
                    <Input id="businessName" autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} aria-invalid={fieldError?.path === 'businessName'} />
                    <FieldDescription>{t('businessNameHint')}</FieldDescription>
                    {fieldError?.path === 'businessName' ? <FieldError>{fieldError.message}</FieldError> : null}
                  </Field>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div className="min-h-4 flex-1" />
            {fieldError && fieldError.path !== 'businessName' ? (
              <p className="mt-4 flex items-center gap-1.5 rounded-sm bg-[#fff1ef] px-3 py-2 text-xs text-destructive" role="alert">
                <Icon name="error" size={15} />
                {fieldError.message}
              </p>
            ) : !ready && categories.data ? (
              <p className="mt-4 text-center text-xs text-muted-foreground">{t('pickToContinue')}</p>
            ) : null}
            <Button className="mt-3 w-full" disabled={!ready || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? <Spinner /> : null}
              {create.isPending ? t('creating') : t('create')}
              {create.isPending ? null : <Icon name="arrow-forward" size={18} />}
            </Button>
            <SecureNote className="mt-3">{t('secure')}</SecureNote>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
