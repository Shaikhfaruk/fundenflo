'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { KeyValues, Section } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link, useRouter } from '@/i18n/navigation';
import { lenderKeys, lenderProductsQuery, proposeProductChange } from '@/lib/api/lender';
import type { LenderProduct, LenderProductContent } from '@/lib/api/types/lender.types';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { LENDER_VIEWER_ROLE, PRODUCT_REASON_MAX_LENGTH, PRODUCT_REASON_MIN_LENGTH } from '@/lib/constants/lender.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { formatDate } from '@/lib/format/date';
import { attributeTitle, textOf } from '@/lib/format/fact';
import { pickText } from '@/lib/format/localised';
import { formatPaise, paiseFromRupees, rupeesFromPaiseValue } from '@/lib/format/money';
import { useMe } from '@/lib/session/use-me';

type Rule = LenderProductContent['eligibility']['hard'][number];

const ruleText = (rule: Rule, locale: string) => pickText(rule.pass ?? null, locale) || `${attributeTitle(rule.when.attr)} ${rule.when.op} ${textOf(rule.when.value)}`;

function ProductCard({ product, index, canPropose }: { product: LenderProduct; index: number; canPropose: boolean }) {
  const t = useTranslations('lender.products');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const { content } = product;
  return (
    <motion.article initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }} className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-heading text-lg font-semibold text-navy">{pickText(product.name, locale) || product.key}</h2>
          <p className="text-xs text-muted-foreground">{t('liveSince', { number: product.number, date: formatDate(product.effectiveFrom, locale) })}</p>
        </div>
        {product.pendingVersion ? (
          <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-semibold text-[#5d4200]">{t('pending', { number: product.pendingVersion.number })}</span>
        ) : canPropose ? (
          <ButtonLink href={RoutePath.lenderProduct(product.id)} size="sm" variant="outline">
            <Icon name="edit" size={16} />
            {t('propose')}
          </ButtonLink>
        ) : null}
      </div>
      <KeyValues
        columns={3}
        items={[
          { label: t('category'), value: categoryLabel(content.category) || content.category },
          { label: t('amount'), value: `${formatPaise(content.amountPaise.min, locale, true)} – ${formatPaise(content.amountPaise.max, locale, true)}` },
          { label: t('tenure'), value: t('tenureRange', { min: content.tenureMonths.min, max: content.tenureMonths.max }) },
          { label: t('coverage'), value: content.coverage.nationwide ? t('nationwide') : t('states', { count: content.coverage.states?.length ?? 0 }) },
          { label: t('segments'), value: [...content.segments, ...(content.subSegments ?? [])].join(', ') },
          { label: t('pricing'), value: pickText(content.pricingDisclosure ?? null, locale) || '—' },
        ]}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t('mustHave')}</h3>
          {content.eligibility.hard.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : null}
          {content.eligibility.hard.map((rule) => (
            <p key={rule.id} className="flex items-start gap-2 text-sm text-foreground">
              <Icon name="check-circle" size={15} className="mt-0.5 text-success" />
              {ruleText(rule, locale)}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t('preferred')}</h3>
          {content.eligibility.soft.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : null}
          {content.eligibility.soft.map((rule) => (
            <p key={rule.id} className="flex items-start gap-2 text-sm text-foreground">
              <Icon name="star" size={15} className="mt-0.5 text-gold-ink" />
              {ruleText(rule, locale)}
            </p>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

export function LenderProducts() {
  const t = useTranslations('lender.products');
  const { data: me } = useMe();
  const products = useQuery(lenderProductsQuery());
  if (products.isPending) return <ScreenSkeleton />;
  const items = products.data?.items ?? [];
  const canPropose = me?.activeContext?.role !== LENDER_VIEWER_ROLE;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={products.data?.lender.name ?? t('eyebrow')} title={t('title')} description={t('description')} />
      {items.length === 0 ? <EmptyState icon="assignment" title={t('emptyTitle')} body={t('emptyBody')} /> : items.map((product, index) => <ProductCard key={product.id} product={product} index={index} canPropose={canPropose} />)}
    </div>
  );
}

const isNumber = (value: unknown): value is number => typeof value === 'number';

function ChangeForm({ product }: { product: LenderProduct }) {
  const t = useTranslations('lender.change');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const ids = { minAmount: useId(), maxAmount: useId(), minTenure: useId(), maxTenure: useId(), pricing: useId(), reason: useId() };
  const { content } = product;
  const rules = [...content.eligibility.hard.map((rule) => ({ rule, kind: 'hard' as const })), ...content.eligibility.soft.map((rule) => ({ rule, kind: 'soft' as const }))].filter(({ rule }) => isNumber(rule.when.value));
  const [minAmount, setMinAmount] = useState(String(rupeesFromPaiseValue(content.amountPaise.min)));
  const [maxAmount, setMaxAmount] = useState(String(rupeesFromPaiseValue(content.amountPaise.max)));
  const [minTenure, setMinTenure] = useState(String(content.tenureMonths.min));
  const [maxTenure, setMaxTenure] = useState(String(content.tenureMonths.max));
  const [nationwide, setNationwide] = useState(content.coverage.nationwide === true);
  const [pricing, setPricing] = useState(pickText(content.pricingDisclosure ?? null, locale));
  const [thresholds, setThresholds] = useState<Record<string, string>>(() => Object.fromEntries(rules.map(({ rule }) => [rule.id, textOf(rule.when.value)])));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const numbers = [minAmount, maxAmount, minTenure, maxTenure, ...Object.values(thresholds)].map((value) => Number(value.replaceAll(',', '')));
  const valid = numbers.every((value) => Number.isFinite(value) && value >= 0) && Number(minAmount) <= Number(maxAmount) && Number(minTenure) <= Number(maxTenure) && reason.trim().length >= PRODUCT_REASON_MIN_LENGTH;
  const withThreshold = (rule: Rule): Rule => (rule.id in thresholds ? { ...rule, when: { ...rule.when, value: Number(thresholds[rule.id]?.replaceAll(',', '')) } } : rule);
  const propose = useMutation({
    mutationFn: () =>
      proposeProductChange(product.id, {
        reason: reason.trim(),
        content: {
          ...content,
          amountPaise: { min: paiseFromRupees(Number(minAmount.replaceAll(',', ''))), max: paiseFromRupees(Number(maxAmount.replaceAll(',', ''))) },
          tenureMonths: { min: Number(minTenure), max: Number(maxTenure) },
          coverage: { ...content.coverage, nationwide },
          ...(pricing.trim() ? { pricingDisclosure: { ...content.pricingDisclosure, en: pricing.trim() } } : {}),
          eligibility: { hard: content.eligibility.hard.map(withThreshold), soft: content.eligibility.soft.map(withThreshold) },
        },
      }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('sent'));
      void queryClient.invalidateQueries({ queryKey: lenderKeys.all });
      router.push(AppPath.LenderProducts);
    },
    onError: (failure) => setError(errorText(failure)),
  });
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.LenderProducts} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader eyebrow={t('eyebrow')} title={pickText(product.name, locale) || product.key} description={t('description')} />
      <Section title={t('limits')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={ids.minAmount}>{t('minAmount')}</FieldLabel>
            <Input id={ids.minAmount} inputMode="decimal" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} className="tabular" />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.maxAmount}>{t('maxAmount')}</FieldLabel>
            <Input id={ids.maxAmount} inputMode="decimal" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} className="tabular" />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.minTenure}>{t('minTenure')}</FieldLabel>
            <Input id={ids.minTenure} inputMode="numeric" value={minTenure} onChange={(event) => setMinTenure(event.target.value.replaceAll(/\D/g, ''))} className="tabular" />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.maxTenure}>{t('maxTenure')}</FieldLabel>
            <Input id={ids.maxTenure} inputMode="numeric" value={maxTenure} onChange={(event) => setMaxTenure(event.target.value.replaceAll(/\D/g, ''))} className="tabular" />
          </Field>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
          {t('nationwide')}
          <Switch checked={nationwide} onCheckedChange={setNationwide} />
        </label>
        <Field>
          <FieldLabel htmlFor={ids.pricing}>{t('pricing')}</FieldLabel>
          <Input id={ids.pricing} value={pricing} maxLength={200} onChange={(event) => setPricing(event.target.value)} />
        </Field>
      </Section>
      {rules.length > 0 ? (
        <Section title={t('criteria')} delay={0.04}>
          <div className="grid gap-4 sm:grid-cols-2">
            {rules.map(({ rule, kind }) => (
              <Field key={rule.id}>
                <FieldLabel htmlFor={`rule-${rule.id}`}>{`${attributeTitle(rule.when.attr)} (${t(kind)})`}</FieldLabel>
                <Input id={`rule-${rule.id}`} inputMode="decimal" value={thresholds[rule.id] ?? ''} onChange={(event) => setThresholds((current) => ({ ...current, [rule.id]: event.target.value }))} className="tabular" />
                <FieldDescription>{t('ruleHint', { op: rule.when.op, text: pickText(rule.pass ?? null, locale) || '—' })}</FieldDescription>
              </Field>
            ))}
          </div>
        </Section>
      ) : null}
      <Section title={t('why')} delay={0.08}>
        <Field>
          <FieldLabel htmlFor={ids.reason}>{t('reason')}</FieldLabel>
          <Textarea id={ids.reason} rows={3} value={reason} maxLength={PRODUCT_REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} />
          <FieldDescription>{t('reviewNote')}</FieldDescription>
        </Field>
        {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
        <Button className="self-start" onClick={() => propose.mutate()} disabled={!valid || propose.isPending}>
          {propose.isPending ? <Spinner /> : null}
          {t('send')}
        </Button>
      </Section>
    </div>
  );
}

export function LenderProductChange() {
  const t = useTranslations('lender.change');
  const { id } = useParams<{ id: string }>();
  const products = useQuery(lenderProductsQuery());
  if (products.isPending) return <ScreenSkeleton />;
  const product = products.data?.items.find((item) => item.id === id);
  if (!product) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  if (product.pendingVersion) return <EmptyState icon="hourglass" title={t('pendingTitle')} body={t('pendingBody', { number: product.pendingVersion.number })} action={<ButtonLink href={AppPath.LenderProducts}>{t('back')}</ButtonLink>} />;
  return <ChangeForm product={product} />;
}
