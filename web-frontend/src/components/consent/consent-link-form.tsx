'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { AuthFormSkeleton } from '@/components/shell/auth-shell';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SecureNote } from '@/components/ui/secure-note';
import { Spinner } from '@/components/ui/spinner';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useErrorText } from '@/hooks/use-error-toast';
import { ApiError } from '@/lib/api/api-error';
import { answerConsentRequest, consentRequestQuery } from '@/lib/api/public-consent';
import type { ConsentTemplate } from '@/lib/api/types/consent.types';
import { CONSENT_LINK_TOKEN_PARAM, CONSENT_LINK_TOKEN_PATTERN } from '@/lib/constants/consent.constants';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { formatDate } from '@/lib/format/date';

function Notice({ icon, title, body, tone }: { icon: 'check-circle' | 'error'; title: string; body: string; tone: 'success' | 'danger' }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: Duration.Base, ease: EASE_OUT }} className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
      <span className={tone === 'success' ? 'flex size-14 items-center justify-center rounded-full bg-success-soft text-success' : 'flex size-14 items-center justify-center rounded-full bg-error-soft text-destructive'}>
        <Icon name={icon} size={30} />
      </span>
      <h2 className="font-heading text-xl font-semibold text-navy">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </motion.div>
  );
}

function ConsentChoices({ token, template, expiresAt }: { token: string; template: ConsentTemplate; expiresAt: string }) {
  const t = useTranslations('consentLink');
  const locale = useLocale();
  const errorText = useErrorText();
  const [choices, setChoices] = useState<Record<string, boolean>>(() => Object.fromEntries(template.items.map((item) => [item.purpose, item.required])));
  const missing = template.items.filter((item) => item.required && !choices[item.purpose]);
  const save = useMutation({
    mutationFn: () => answerConsentRequest(token, { locale, items: template.items.map((item) => ({ purpose: item.purpose, granted: choices[item.purpose] ?? false })) }),
    meta: { handlesError: true },
  });
  if (save.isSuccess) return <Notice icon="check-circle" tone="success" title={t('doneTitle')} body={save.data.missingRequired.length > 0 ? t('donePartial') : t('doneBody')} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold text-navy">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {template.items.map((item, index) => (
          <motion.div key={item.purpose} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }}>
            <ToggleRow title={item.title} description={item.summary} details={item.details} badge={item.required ? t('required') : undefined} checked={choices[item.purpose] ?? false} onCheckedChange={(checked) => setChoices((state) => ({ ...state, [item.purpose]: checked }))} disabled={save.isPending} />
          </motion.div>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {save.error ? (
          <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 rounded-sm bg-error-soft px-3 py-2 text-xs text-destructive" role="alert">
            <Icon name="error" size={15} />
            {errorText(save.error)}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <Spinner /> : null}
        {missing.length > 0 ? t('saveWithout') : t('agree')}
      </Button>
      {template.policyUrl ? (
        <a href={template.policyUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 text-sm font-semibold text-gold-ink">
          {t('policy')}
          <Icon name="arrow-outward" size={14} />
        </a>
      ) : null}
      <SecureNote>{t('expires', { date: formatDate(expiresAt, locale) })}</SecureNote>
    </div>
  );
}

export function ConsentLinkForm() {
  const t = useTranslations('consentLink');
  const token = useSearchParams().get(CONSENT_LINK_TOKEN_PARAM) ?? '';
  const valid = CONSENT_LINK_TOKEN_PATTERN.test(token);
  const request = useQuery({ ...consentRequestQuery(token), enabled: valid });
  if (!valid) return <Notice icon="error" tone="danger" title={t('invalidTitle')} body={t('invalidBody')} />;
  if (request.isPending) return <AuthFormSkeleton />;
  if (request.error || !request.data) {
    const gone = request.error instanceof ApiError && (request.error.status === 410 || request.error.status === 404);
    return <Notice icon="error" tone="danger" title={gone ? t('invalidTitle') : t('errorTitle')} body={gone ? t('invalidBody') : t('errorBody')} />;
  }
  return <ConsentChoices token={token} template={request.data.template} expiresAt={request.data.expiresAt} />;
}
