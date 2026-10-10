'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { CityPicker, type CityChoice } from '@/components/journey/city-picker';
import { FadeIn } from '@/components/motion/fade-in';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { ChoiceChip, ChoiceRow } from '@/components/ui/choice';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Input } from '@/components/ui/input';
import { MobileInput } from '@/components/ui/mobile-input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { categoriesQuery, segmentsQuery } from '@/lib/api/catalog';
import { consentTemplateQuery } from '@/lib/api/consents';
import { partnerLeadKeys, referLead } from '@/lib/api/partner-leads';
import { partnerKeys } from '@/lib/api/partners';
import type { ReferLeadResult } from '@/lib/api/types/partner-lead.types';
import { DEFAULT_COUNTRY_CODE, INDIAN_MOBILE_PATTERN } from '@/lib/constants/auth.constants';
import { ErrorCode } from '@/lib/constants/errors.constants';
import { NAME_MIN_LENGTH } from '@/lib/constants/kyc.constants';
import { LEAD_CAPTURE_CONSENT_CONTEXT } from '@/lib/constants/partner.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { formatDate } from '@/lib/format/date';

const ConsentMode = { Link: 'link', Now: 'now' } as const;

type ConsentMode = (typeof ConsentMode)[keyof typeof ConsentMode];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</h2>
      {children}
    </section>
  );
}

function Result({ result, name, onAnother }: { result: ReferLeadResult; name: string; onAnother: () => void }) {
  const t = useTranslations('partner.newLead');
  const locale = useLocale();
  return (
    <FadeIn className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <IconTile icon={result.assigned ? 'check-circle' : 'sms'} tone={result.assigned ? 'success' : 'gold'} />
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold text-navy">{result.assigned ? t('assignedTitle', { name }) : t('waitingTitle', { name })}</h2>
          <p className="text-sm text-muted-foreground">{result.assigned ? t('assignedBody') : result.consentRequested ? t('waitingBody', { name }) : t('heldBody')}</p>
          <p className="text-xs text-muted-foreground">{t('protectedUntil', { ref: result.lead.ref, date: formatDate(result.attribution.protectedUntil, locale) })}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {result.assigned ? (
          <ButtonLink href={RoutePath.partnerLead(result.lead.id)} size="sm">
            {t('openLead')}
            <Icon name="arrow-forward" size={16} />
          </ButtonLink>
        ) : (
          <ButtonLink href={AppPath.PartnerReferrals} size="sm" variant="outline">
            {t('seeReferrals')}
          </ButtonLink>
        )}
        <Button size="sm" variant="ghost" onClick={onAnother}>
          {t('another')}
        </Button>
      </div>
    </FadeIn>
  );
}

export function PartnerLeadNew() {
  const t = useTranslations('partner.newLead');
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const segments = useQuery(segmentsQuery());
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [segment, setSegment] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [city, setCity] = useState<CityChoice | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [mode, setMode] = useState<ConsentMode>(ConsentMode.Link);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<{ message: string; protected: boolean } | null>(null);
  const [result, setResult] = useState<ReferLeadResult | null>(null);
  const categories = useQuery({ ...categoriesQuery({ segment: segment ?? undefined }), enabled: Boolean(segment) });
  const template = useQuery({ ...consentTemplateQuery(LEAD_CAPTURE_CONSENT_CONTEXT), enabled: mode === ConsentMode.Now });
  const items = template.data?.items ?? [];
  const granted = (purpose: string, required: boolean) => choices[purpose] ?? required;
  const consentReady = mode === ConsentMode.Link || (template.data !== undefined && items.every((item) => !item.required || granted(item.purpose, item.required)));
  const valid = name.trim().length >= NAME_MIN_LENGTH && INDIAN_MOBILE_PATTERN.test(mobile) && consentReady;
  const save = useMutation({
    mutationFn: () =>
      referLead({
        name: name.trim(),
        mobile,
        countryCode: DEFAULT_COUNTRY_CODE,
        businessName: businessName.trim() || undefined,
        segment: segment ?? undefined,
        category: category ?? undefined,
        cityId: city?.cityId,
        city: city?.cityId ? undefined : city?.city,
        pincode: city?.pincode,
        amountText: amountText.trim() || undefined,
        requestConsent: mode === ConsentMode.Link,
        consent: mode === ConsentMode.Now && template.data ? { templateVersionId: template.data.versionId, items: items.map((item) => ({ purpose: item.purpose, granted: granted(item.purpose, item.required) })) } : undefined,
      }),
    meta: { handlesError: true },
    onSuccess: (next) => {
      setResult(next);
      toast.success(t('saved', { ref: next.lead.ref }));
      void queryClient.invalidateQueries({ queryKey: partnerLeadKeys.all });
      void queryClient.invalidateQueries({ queryKey: partnerKeys.dashboard() });
    },
    onError: (failure) => setError({ message: errorText(failure), protected: failure instanceof ApiError && failure.code === ErrorCode.LeadProtected }),
  });
  const reset = () => {
    setResult(null);
    setName('');
    setMobile('');
    setBusinessName('');
    setAmountText('');
    setCity(null);
    setError(null);
  };
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <Link href={AppPath.PartnerLeads} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      {result ? (
        <Result result={result} name={name.trim()} onAnother={reset} />
      ) : (
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card">
          <Group label={t('who')}>
            <Field>
              <FieldLabel htmlFor="lead-name">{t('name')}</FieldLabel>
              <Input id="lead-name" autoComplete="off" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-mobile">{t('mobile')}</FieldLabel>
              <MobileInput id="lead-mobile" value={mobile} onValueChange={setMobile} valid={INDIAN_MOBILE_PATTERN.test(mobile)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-business">{t('businessName')}</FieldLabel>
              <Input id="lead-business" autoComplete="off" value={businessName} maxLength={160} onChange={(event) => setBusinessName(event.target.value)} />
            </Field>
          </Group>
          <Group label={t('need')}>
            <div className="flex flex-wrap gap-2">
              {segments.data?.items.map((item) => (
                <ChoiceChip
                  key={item.key}
                  selected={segment === item.key}
                  label={item.label}
                  onToggle={() => {
                    setSegment(segment === item.key ? null : item.key);
                    setCategory(null);
                  }}
                  className="min-h-10 text-[13px]"
                />
              ))}
            </div>
            {segment ? (
              <div className="flex flex-wrap gap-2">
                {categories.data?.items.map((item) => (
                  <ChoiceChip key={item.key} selected={category === item.key} label={item.label} onToggle={() => setCategory(category === item.key ? null : item.key)} className="min-h-9 text-xs" />
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="lead-amount">{t('amount')}</FieldLabel>
                <Input id="lead-amount" placeholder={t('amountPlaceholder')} value={amountText} maxLength={60} onChange={(event) => setAmountText(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel>{t('city')}</FieldLabel>
                <Button variant="outline" className="h-11 justify-between font-normal" onClick={() => setCityOpen(true)}>
                  <span className="truncate">{city?.label ?? t('chooseCity')}</span>
                  <Icon name="expand-more" size={18} />
                </Button>
              </Field>
            </div>
          </Group>
          <Group label={t('consent')}>
            <ChoiceRow selected={mode === ConsentMode.Link} onSelect={() => setMode(ConsentMode.Link)} icon="sms" title={t('consentLink')} description={t('consentLinkBody')} />
            <ChoiceRow selected={mode === ConsentMode.Now} onSelect={() => setMode(ConsentMode.Now)} icon="handshake" title={t('consentNow')} description={t('consentNowBody')} />
            {mode === ConsentMode.Now ? (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <ToggleRow key={item.purpose} title={item.title} description={item.summary} checked={granted(item.purpose, item.required)} onCheckedChange={(checked) => setChoices((current) => ({ ...current, [item.purpose]: checked }))} />
                ))}
                <FieldDescription>{t('consentNowHint')}</FieldDescription>
              </div>
            ) : null}
          </Group>
          {error ? (
            <p className="flex flex-col gap-1 rounded-sm bg-error-soft px-3 py-2 text-xs text-destructive" role="alert">
              <span className="flex items-center gap-1.5">
                <Icon name="error" size={15} />
                {error.message}
              </span>
              {error.protected ? (
                <Link href={AppPath.PartnerNewDispute} className="font-semibold text-navy underline-offset-4 hover:underline">
                  {t('claim')}
                </Link>
              ) : null}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={!valid || save.isPending}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? <Spinner /> : null}
            {t('submit')}
          </Button>
        </div>
      )}
      <CityPicker open={cityOpen} onOpenChange={setCityOpen} title={t('city')} selected={city?.cityId ?? null} onSelect={setCity} />
    </div>
  );
}
