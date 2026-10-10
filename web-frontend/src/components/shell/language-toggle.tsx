'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { DEFAULT_LOCALE, HERO_LOCALES, LOCALES } from '@/lib/constants/locale.constants';
import { SOFT_SPRING } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

const AVAILABLE: readonly string[] = LOCALES;

function Options({ current, onPick }: { current: string; onPick?: (locale: string) => void }) {
  const t = useTranslations('common');
  return (
    <div className="flex rounded-full bg-white/10 p-0.5">
      {HERO_LOCALES.map((option) => {
        const on = current === option.code;
        return (
          <button key={option.code} type="button" aria-pressed={on} aria-label={`${t('language')}: ${option.name}`} onClick={() => onPick?.(option.code)} className={cn('relative flex h-7 min-w-9 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold text-white/70 transition-colors', on && 'text-navy')}>
            {on ? <motion.span layoutId="hero-locale" transition={SOFT_SPRING} className="absolute inset-0 rounded-full bg-gold-deep" /> : null}
            <span className="relative">{option.short}</span>
          </button>
        );
      })}
    </div>
  );
}

function LiveToggle() {
  const t = useTranslations('auth.hero');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const shown = pending ?? locale;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <Options
        current={shown}
        onPick={(next) => {
          if (AVAILABLE.includes(next)) {
            setPending(null);
            router.replace(pathname, { locale: next });
          } else setPending(next === DEFAULT_LOCALE ? null : next);
        }}
      />
      <AnimatePresence>
        {pending ? (
          <motion.p key="soon" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-right text-[11px] text-gold" aria-live="polite">
            {t('languageSoon')}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function LanguageToggle() {
  const locale = useLocale();
  return (
    <Suspense fallback={<Options current={locale} />}>
      <LiveToggle />
    </Suspense>
  );
}
