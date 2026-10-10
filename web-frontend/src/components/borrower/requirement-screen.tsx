'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useJourneyPaths } from '@/components/journey/journey-mode';
import { type CityChoice, CityPicker } from '@/components/journey/city-picker';
import { JourneyFooter } from '@/components/journey/journey-footer';
import { JourneyPage } from '@/components/journey/journey-page';
import { useTenureLabel } from '@/components/journey/use-tenure-label';
import { ZoomIn } from '@/components/motion/zoom-in';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { ChoiceChip, ChoiceRow } from '@/components/ui/choice';
import { Icon, isIconName } from '@/components/ui/icon';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { applicationKeys } from '@/lib/api/applications';
import { categoriesQuery } from '@/lib/api/catalog';
import { applicationQuery, updateRequirement } from '@/lib/api/journey';
import type { Application, RequirementInput } from '@/lib/api/types/application.types';
import type { LoanCategory } from '@/lib/api/types/catalog.types';
import { BUSINESS_SEGMENT, JOURNEY_SCREEN_STEP, JourneyScreen, PURPOSE_NOTE_MAX_LENGTH, PURPOSE_NOTE_MIN_LENGTH } from '@/lib/constants/journey.constants';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { estimateEmiPaise, formatPaise, groupRupees, paiseFromRupees, rupeesFromPaiseValue } from '@/lib/format/money';
import { cn } from '@/lib/utils';

const MAX_RUPEE_DIGITS = 10;
const LONG_AMOUNT_LENGTH = 11;

type Substep = 'amount' | 'purpose';

const SWAP = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: Duration.Base, ease: EASE_OUT } } as const;

const clampAmount = (paise: number, category: LoanCategory) => Math.min(category.maxAmountPaise, Math.max(category.minAmountPaise, paise));

function RequirementForm({ application, categories }: { application: Application; categories: LoanCategory[] }) {
  const paths = useJourneyPaths();
  const t = useTranslations('flow.requirement');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const tenureLabel = useTenureLabel();
  const category = categories.find((item) => item.key === application.categoryKey) ?? categories[0];
  const [substep, setSubstep] = useState<Substep>(application.amountPaise && application.tenureMonths && application.location.cityId ? 'purpose' : 'amount');
  const [amount, setAmount] = useState(() => clampAmount(application.amountPaise ?? category.defaultAmountPaise, category));
  const [amountText, setAmountText] = useState(() => groupRupees(rupeesFromPaiseValue(application.amountPaise ?? category.defaultAmountPaise)));
  const [tenure, setTenure] = useState<number | null>(application.tenureMonths && category.tenureOptionsMonths.includes(application.tenureMonths) ? application.tenureMonths : null);
  const [place, setPlace] = useState<CityChoice | null>(application.location.city ? { cityId: application.location.city.id, label: application.location.city.name } : null);
  const [placeChanged, setPlaceChanged] = useState(false);
  const [purpose, setPurpose] = useState<string | null>(application.purposeKey);
  const [note, setNote] = useState(application.purposeNote ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const business = application.segmentKey === BUSINESS_SEGMENT;
  const locationLabel = business ? t('businessLocation') : t('currentCity');
  const amountValid = amount >= category.minAmountPaise && amount <= category.maxAmountPaise;
  const amountReady = amountValid && tenure !== null && place !== null;
  const purposeConfig = category.purposes.find((item) => item.key === purpose);
  const noteValid = !purposeConfig?.requiresNote || note.trim().length >= PURPOSE_NOTE_MIN_LENGTH;
  const purposeReady = Boolean(purposeConfig) && noteValid;
  const emi = amountValid && tenure && category.illustrativeRateBps ? estimateEmiPaise(amount, category.illustrativeRateBps, tenure) : 0;

  const save = useMutation({
    mutationFn: (body: RequirementInput) => updateRequirement(application.id, body, queryClient.getQueryData<Application>(applicationKeys.detail(application.id))?.version ?? application.version),
    meta: { handlesError: true },
    onSuccess: (updated) => {
      queryClient.setQueryData(applicationKeys.detail(application.id), updated);
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all, refetchType: 'inactive' });
      setError(null);
    },
    onError: (failure) => setError(errorText(failure)),
  });

  const onType = (value: string) => {
    const digits = value.replaceAll(/\D/g, '').replace(/^0+/, '').slice(0, MAX_RUPEE_DIGITS);
    const rupees = Number(digits || 0);
    setAmountText(digits ? groupRupees(rupees) : '');
    setAmount(paiseFromRupees(rupees));
  };

  const onSlide = (paise: number) => {
    setAmount(paise);
    setAmountText(groupRupees(rupeesFromPaiseValue(paise)));
  };

  const continueAmount = () => {
    if (!amountReady || tenure === null || !place) return;
    const location = placeChanged ? { cityId: place.cityId, city: place.cityId ? undefined : place.city, pincode: place.pincode } : {};
    save.mutate({ amountPaise: amount, tenureMonths: tenure, ...location }, { onSuccess: () => setSubstep('purpose') });
  };

  const continuePurpose = () => {
    if (!purposeReady || !purpose) return;
    save.mutate({ purpose, purposeNote: note.trim() || null }, { onSuccess: () => router.push(paths.step(application.id, JourneyScreen.Questions)) });
  };

  const changeCategory = (next: string) => {
    setCategoryOpen(false);
    if (next === category.key) return;
    const target = categories.find((item) => item.key === next);
    if (!target) return;
    save.mutate({ category: next, purpose: null, purposeNote: null }, {
      onSuccess: () => {
        setPurpose(null);
        setNote('');
        setTenure(null);
        onSlide(clampAmount(amount, target));
      },
    });
  };

  return (
    <JourneyPage
      applicationId={application.id}
      step={JOURNEY_SCREEN_STEP[JourneyScreen.Requirement]}
      eyebrow={substep === 'amount' ? t('eyebrowAmount') : t('eyebrowPurpose')}
      title={substep === 'amount' ? t('amountTitle') : t('purposeTitle')}
      description={substep === 'amount' ? t('amountBody') : t('purposeBody')}
      onBack={substep === 'purpose' ? () => setSubstep('amount') : undefined}
    >
      <AnimatePresence mode="wait" initial={false}>
        {substep === 'amount' ? (
          <motion.div key="amount" {...SWAP} className="flex flex-1 flex-col">
            <button type="button" onClick={() => setCategoryOpen(true)} className="flex max-w-full items-center gap-2 self-start rounded-full bg-subtle py-1.5 pr-3 pl-1.5 text-left transition-colors hover:bg-[#e8edf3]">
              <span className="flex size-6 items-center justify-center rounded-full bg-navy text-white">
                <Icon name={isIconName(category.icon) ? category.icon : 'payments'} size={14} />
              </span>
              <span className="truncate text-[13px] font-semibold text-navy">{category.label}</span>
              <span className="text-xs font-semibold text-gold-ink">{t('change')}</span>
            </button>
            <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: Duration.Slow, ease: EASE_OUT }} className="mt-4 rounded-xl bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-semibold text-foreground">{t('howMuch')}</h2>
                <span className="rounded-xs bg-subtle px-2 py-1 text-[10px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t('requestedLimit')}</span>
              </div>
              <label className={cn('-mx-2.5 mt-4 flex items-center gap-0.5 rounded-lg border-[1.5px] border-transparent px-2.5 transition-colors focus-within:border-border focus-within:bg-background', !amountValid && 'border-destructive bg-[#fff8f7] focus-within:border-destructive focus-within:bg-[#fff8f7]')}>
                <span className="font-heading text-[30px] font-semibold text-navy">₹</span>
                <input
                  value={amountText}
                  onChange={(event) => onType(event.target.value)}
                  inputMode="numeric"
                  aria-label={t('amountLabel', { min: formatPaise(category.minAmountPaise, locale, true), max: formatPaise(category.maxAmountPaise, locale, true) })}
                  aria-invalid={!amountValid}
                  className={cn('h-14 min-w-0 flex-1 bg-transparent font-heading text-[32px] font-semibold text-navy tabular outline-none placeholder:text-slate', amountText.length > LONG_AMOUNT_LENGTH && 'text-2xl')}
                  placeholder="0"
                />
                <Icon name="edit" size={18} className="text-muted-foreground" />
              </label>
              {amountValid ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{formatPaise(amount, locale, true)}</p>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <Icon name="error" size={14} />
                  {t('amountRange', { min: formatPaise(category.minAmountPaise, locale, true), max: formatPaise(category.maxAmountPaise, locale, true) })}
                </p>
              )}
              <Slider value={clampAmount(amount, category)} min={category.minAmountPaise} max={category.maxAmountPaise} step={category.stepPaise} onValueChange={onSlide} label={t('howMuch')} valueText={(value) => formatPaise(value, locale)} className="mt-2" />
              <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular">
                <span>{formatPaise(category.minAmountPaise, locale, true)}</span>
                <span>{formatPaise(category.maxAmountPaise, locale, true)}</span>
              </div>
              <p className="mt-4 mb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t('tenure')}</p>
              <div className="grid grid-cols-4 gap-2">
                {category.tenureOptionsMonths.map((months) => (
                  <ChoiceChip key={months} selected={tenure === months} label={tenureLabel(months)} onToggle={() => setTenure(months)} className="justify-center px-2" />
                ))}
              </div>
              <p className="mt-4 mb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{locationLabel}</p>
              <button type="button" onClick={() => setPickerOpen(true)} className="flex h-[54px] w-full items-center gap-3 rounded-lg bg-field px-3.5 text-left transition-colors hover:bg-[#eceff3]">
                <Icon name="location" size={20} className={place ? 'text-navy' : 'text-slate'} />
                <span className={cn('min-w-0 flex-1 truncate text-[15px] font-medium text-foreground', !place && 'text-muted-foreground')}>{place?.label ?? t('selectCity')}</span>
                <span className="text-xs font-semibold text-gold-ink">{place ? t('change') : t('select')}</span>
              </button>
            </motion.section>
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: Duration.Slow, ease: EASE_OUT }} className="mt-4 flex items-start gap-3 rounded-xl bg-gold-soft p-3.5">
              <Icon name="verified" size={18} className="mt-0.5 text-gold-ink" />
              {emi && tenure ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-navy">
                    {t('emi')} <span className="font-semibold tabular">{t('perMonth', { amount: formatPaise(emi, locale) })}</span>
                  </p>
                  <p className="text-xs/[17px] text-[#5d4200]/80">{t('emiNote', { rate: (category.illustrativeRateBps ?? 0) / 100, tenure: tenureLabel(tenure) })}</p>
                </div>
              ) : (
                <p className="text-sm text-navy">{t('emiEmpty')}</p>
              )}
            </motion.div>
            <div className="min-h-4 flex-1" />
            <JourneyFooter label={t('continue')} onContinue={continueAmount} disabled={!amountReady} pending={save.isPending} hint={!amountValid ? t('hintAmount') : tenure === null ? t('hintTenure') : !place ? t('hintCity', { place: locationLabel }) : null} error={error} note={t('secure')} />
          </motion.div>
        ) : (
          <motion.div key="purpose" {...SWAP} className="flex flex-1 flex-col">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-subtle p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">{category.label}</p>
                <p className="text-xs/[18px] text-muted-foreground tabular">{[formatPaise(amount, locale), tenure ? tenureLabel(tenure) : null, place?.label].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => setSubstep('amount')} className="flex min-h-8 items-center gap-1 text-xs font-semibold text-gold-ink">
                <Icon name="edit" size={14} />
                {t('edit')}
              </button>
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {category.purposes.map((item, index) => {
                const on = purpose === item.key;
                return (
                  <motion.li key={item.key} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + index * 0.04, duration: Duration.Base, ease: EASE_OUT }}>
                    <motion.button
                      type="button"
                      aria-pressed={on}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setPurpose(item.key)}
                      className={cn('flex min-h-[54px] w-full items-center gap-3 rounded-lg border-[1.5px] border-transparent bg-card px-4 text-left shadow-card transition-colors', on && 'border-navy bg-background')}
                    >
                      <span className={cn('flex-1 text-[15px] text-foreground', on && 'font-semibold text-navy')}>{item.label}</span>
                      <span className="relative flex size-[22px] items-center justify-center rounded-full border-[2.5px] border-border" aria-hidden="true">
                        <ZoomIn show={on} className="absolute -inset-[2.5px] flex items-center justify-center rounded-full bg-gold-deep text-white">
                          <Icon name="check" size={13} />
                        </ZoomIn>
                      </span>
                    </motion.button>
                  </motion.li>
                );
              })}
            </ul>
            <AnimatePresence initial={false}>
              {purposeConfig ? (
                <motion.div key="note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <label htmlFor="purpose-note" className="mt-4 mb-2 block text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                    {purposeConfig.requiresNote ? t('noteRequired') : t('noteOptional')}
                  </label>
                  <Textarea id="purpose-note" value={note} onChange={(event) => setNote(event.target.value.slice(0, PURPOSE_NOTE_MAX_LENGTH))} placeholder={purposeConfig.requiresNote ? t('notePlaceholderRequired') : t('notePlaceholder')} aria-invalid={!noteValid} rows={4} />
                  <div className="mt-1.5 flex justify-between text-xs">
                    <span className={noteValid ? 'text-muted-foreground' : 'text-destructive'}>{purposeConfig.requiresNote ? (noteValid ? t('required') : t('noteTooShort', { min: PURPOSE_NOTE_MIN_LENGTH })) : ''}</span>
                    <span className="text-slate tabular">
                      {note.length}/{PURPOSE_NOTE_MAX_LENGTH}
                    </span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div className="min-h-4 flex-1" />
            <JourneyFooter label={t('continue')} onContinue={continuePurpose} disabled={!purposeReady} pending={save.isPending} hint={!purposeConfig ? t('hintPurpose') : t('hintNote')} error={error} note={t('secure')} />
          </motion.div>
        )}
      </AnimatePresence>
      <CityPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={locationLabel}
        selected={place?.label}
        onSelect={(choice) => {
          setPlace(choice);
          setPlaceChanged(true);
        }}
      />
      <Sheet open={categoryOpen} onOpenChange={setCategoryOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] w-full max-w-[560px] gap-3 overflow-y-auto px-4 pt-4 pb-4 safe-bottom">
          <SheetHeader className="p-0">
            <SheetTitle className="font-heading text-lg font-semibold text-navy">{t('changeCategory')}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            {categories
              .filter((item) => item.availability?.available ?? true)
              .map((item) => (
                <ChoiceRow key={item.key} selected={item.key === category.key} onSelect={() => changeCategory(item.key)} icon={isIconName(item.icon) ? item.icon : 'payments'} title={item.label} description={`${formatPaise(item.minAmountPaise, locale, true)} – ${formatPaise(item.maxAmountPaise, locale, true)}`} />
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </JourneyPage>
  );
}

export function RequirementScreen() {
  const { id } = useParams<{ id: string }>();
  const application = useQuery(applicationQuery(id));
  const categories = useQuery({ ...categoriesQuery({ segment: application.data?.segmentKey, subSegment: application.data?.subSegmentKey ?? undefined }), enabled: Boolean(application.data) });
  if (!application.data || !categories.data) return <ScreenSkeleton />;
  return <RequirementForm key={application.data.id} application={application.data} categories={categories.data.items} />;
}
