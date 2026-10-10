'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { FadeIn } from '@/components/motion/fade-in';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { MobileInput } from '@/components/ui/mobile-input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useErrorText } from '@/hooks/use-error-toast';
import { Link } from '@/i18n/navigation';
import { claimAttribution } from '@/lib/api/partner-leads';
import { DEFAULT_COUNTRY_CODE, INDIAN_MOBILE_PATTERN } from '@/lib/constants/auth.constants';
import { ATTRIBUTION_NOTE_MAX_LENGTH, ATTRIBUTION_NOTE_MIN_LENGTH } from '@/lib/constants/partner.constants';
import { AppPath } from '@/lib/constants/routes.constants';

export function PartnerDisputeNew() {
  const t = useTranslations('partner.dispute');
  const errorText = useErrorText();
  const [mobile, setMobile] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const claim = useMutation({
    mutationFn: () => claimAttribution({ mobile, countryCode: DEFAULT_COUNTRY_CODE, note: note.trim() }),
    meta: { handlesError: true },
    onError: (failure) => setError(errorText(failure)),
  });
  const valid = INDIAN_MOBILE_PATTERN.test(mobile) && note.trim().length >= ATTRIBUTION_NOTE_MIN_LENGTH;
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <Link href={AppPath.PartnerReferrals} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      {claim.isSuccess ? (
        <FadeIn className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-card">
          <IconTile icon="gavel" tone="gold" />
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-navy">{t('sentTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('sentBody')}</p>
            <ButtonLink href={AppPath.PartnerReferrals} size="sm" variant="outline" className="self-start">
              {t('back')}
            </ButtonLink>
          </div>
        </FadeIn>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card">
          <Field>
            <FieldLabel htmlFor="claim-mobile">{t('mobile')}</FieldLabel>
            <MobileInput id="claim-mobile" value={mobile} onValueChange={setMobile} valid={INDIAN_MOBILE_PATTERN.test(mobile)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="claim-note">{t('note')}</FieldLabel>
            <Textarea id="claim-note" rows={4} value={note} maxLength={ATTRIBUTION_NOTE_MAX_LENGTH} onChange={(event) => setNote(event.target.value)} />
            <FieldDescription>{t('noteHint')}</FieldDescription>
          </Field>
          {error ? (
            <p className="flex items-center gap-1.5 rounded-sm bg-error-soft px-3 py-2 text-xs text-destructive" role="alert">
              <Icon name="error" size={15} />
              {error}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={!valid || claim.isPending}
            onClick={() => {
              setError(null);
              claim.mutate();
            }}
          >
            {claim.isPending ? <Spinner /> : null}
            {t('submit')}
          </Button>
        </div>
      )}
    </div>
  );
}
