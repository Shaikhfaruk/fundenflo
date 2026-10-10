'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Logo } from '@/components/brand/logo';
import { LanguageToggle } from '@/components/shell/language-toggle';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { SecureNote } from '@/components/ui/secure-note';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { APP_TAGLINE } from '@/lib/constants/pwa.constants';

const POINTS: readonly { key: string; icon: IconName }[] = [
  { key: 'upload', icon: 'upload' },
  { key: 'match', icon: 'verified' },
  { key: 'track', icon: 'trending-up' },
];

const DRIFT = { duration: 14, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' } as const;

function Glows() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <motion.span className="absolute -top-24 -right-16 size-72 rounded-full bg-[#1b365d] opacity-50 glow lg:size-[28rem]" animate={{ x: [0, -24, 8], y: [0, 16, -8] }} transition={DRIFT} />
      <motion.span className="absolute -bottom-4 -left-12 size-48 rounded-full bg-gold-deep opacity-10 glow lg:bottom-24 lg:size-80 lg:opacity-[0.14]" animate={{ x: [0, 20, -6], y: [0, -12, 6] }} transition={{ ...DRIFT, duration: 18 }} />
      <span className="absolute inset-0 hidden bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:24px_24px] lg:block" />
    </div>
  );
}

function PreviewCard() {
  const t = useTranslations('auth.hero');
  return (
    <motion.div initial={{ opacity: 0, y: 24, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ delay: 0.3, duration: Duration.Slow, ease: EASE_OUT }} className="relative w-72 self-end">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} className="rounded-2xl bg-card p-4 text-navy shadow-float">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{t('previewLabel')}</span>
          <span className="flex size-6 items-center justify-center rounded-md bg-navy text-gold">
            <Icon name="arrow-outward" size={16} />
          </span>
        </div>
        <p className="mt-3 font-heading text-base font-semibold">{t('previewTitle')}</p>
        {(['cashFlow', 'stability', 'compliance'] as const).map((factor, index) => (
          <div key={factor} className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">{t(`factors.${factor}`)}</span>
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-subtle">
              <motion.span className={index === 1 ? 'block h-full rounded-full bg-gold' : 'block h-full rounded-full bg-success'} initial={{ width: 0 }} animate={{ width: ['76%', '58%', '84%'][index] }} transition={{ delay: 0.6 + index * 0.12, duration: Duration.Slow, ease: EASE_OUT }} />
            </span>
          </div>
        ))}
        <p className="mt-3 text-center text-[8px] tracking-[0.12em] text-muted-foreground uppercase">{t('previewNote')}</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55, duration: Duration.Slow, ease: EASE_OUT }} className="absolute -bottom-6 -left-16 flex items-center gap-2.5 rounded-2xl bg-navy-soft px-3.5 py-3 text-white shadow-float ring-1 ring-white/10">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gold text-navy">
          <Icon name="sparkle" size={18} />
        </span>
        <span className="flex flex-col">
          <span className="font-heading text-xs font-semibold">{t('floatTitle')}</span>
          <span className="text-[10px] text-[#c2d1dc]">{t('floatBody')}</span>
        </span>
      </motion.div>
    </motion.div>
  );
}

function HeroCopy({ headline, subline }: { headline: string; subline: string }) {
  return (
    <div className="flex flex-col gap-2">
      <motion.h1 initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: Duration.Slow, ease: EASE_OUT }} className="font-heading text-[30px] leading-[38px] font-semibold tracking-[-0.01em] text-white lg:text-[40px] lg:leading-[48px]">
        {headline}
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: Duration.Slow, ease: EASE_OUT }} className="max-w-[340px] text-sm leading-[22px] text-slate lg:max-w-md lg:text-base">
        {subline}
      </motion.p>
    </div>
  );
}

export function AuthShell({ headline, subline, compact = false, children }: { headline: string; subline: string; compact?: boolean; children: ReactNode }) {
  const t = useTranslations('auth.hero');
  return (
    <div className="flex min-h-dvh flex-col bg-card lg:flex-row">
      <section className="relative isolate overflow-hidden bg-navy text-white safe-top lg:sticky lg:top-0 lg:h-dvh lg:w-[46%] lg:shrink-0">
        <Glows />
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 pt-4 lg:h-full lg:max-w-[520px] lg:justify-between lg:pb-4">
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-7 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[10px] font-semibold tracking-[0.06em] text-[#eceef0] uppercase">
              <span className="size-1.5 rounded-full bg-gold shadow-glow-gold" aria-hidden="true" />
              {t('pill')}
            </span>
            <LanguageToggle />
          </div>
          <motion.div layout className="flex flex-col gap-4 lg:gap-4">
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: Duration.Slow, ease: EASE_OUT }}>
              <Logo inverse height={compact ? 44 : 62} priority className="-ml-1 transition-[height] duration-300 lg:h-[72px]!" />
            </motion.div>
            <AnimatePresence initial={false}>
              {compact ? null : (
                <motion.div key="copy" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: Duration.Base, ease: EASE_OUT }} className="overflow-hidden lg:hidden">
                  <HeroCopy headline={headline} subline={subline} />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="hidden lg:block">
              <HeroCopy headline={headline} subline={subline} />
            </div>
            <ul className="hidden flex-col gap-3 lg:flex">
              {POINTS.map((point, index) => (
                <motion.li key={point.key} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.24 + index * STAGGER_STEP * 1.5, duration: Duration.Base, ease: EASE_OUT }} className="flex items-center gap-3">
                  <IconTile icon={point.icon} tone="glass" size="md" />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{t(`points.${point.key}.title`)}</span>
                    <span className="text-xs text-slate">{t(`points.${point.key}.body`)}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <div className="hidden lg:block">
            <PreviewCard />
          </div>
          <p className="hidden text-[11px] tracking-[0.12em] text-white/40 uppercase lg:block">{APP_TAGLINE}</p>
          <div className="h-12 lg:hidden" aria-hidden="true" />
        </div>
      </section>
      <section className="relative -top-6 flex flex-1 flex-col rounded-t-3xl bg-card shadow-sheet lg:top-0 lg:items-center lg:justify-center lg:rounded-none lg:shadow-none">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: Duration.Slow, ease: EASE_OUT }} className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pt-3 pb-4 safe-bottom lg:max-w-[440px] lg:flex-none">
          <span className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-[#e7e8eb] lg:hidden" aria-hidden="true" />
          <div className="flex flex-1 flex-col">{children}</div>
          <SecureNote className="mt-4">{t('secure')}</SecureNote>
        </motion.div>
      </section>
    </div>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="h-4 w-20 rounded-md skeleton-shimmer" />
      <span className="h-[54px] rounded-lg skeleton-shimmer" />
      <span className="h-4 w-28 rounded-md skeleton-shimmer" />
      <span className="h-[54px] rounded-lg skeleton-shimmer" />
      <span className="h-13 rounded-lg skeleton-shimmer" />
    </div>
  );
}
