'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

import { Icon, type IconName } from '@/components/ui/icon';
import type { IntroSlide } from '@/lib/constants/intro.constants';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

const CHIP_ICON: Record<IntroSlide, IconName> = { readiness: 'sparkle', matching: 'arrow-outward', progress: 'check' };

function Bar({ width, tone, delay }: { width: string; tone: 'green' | 'gold'; delay: number }) {
  return (
    <span className="h-1.5 w-[45%] overflow-hidden rounded-full bg-[#ebefeb]">
      <motion.span className={cn('block h-full rounded-full', tone === 'green' ? 'bg-[#3d8273]' : 'bg-onboard-gold')} initial={{ width: 0 }} animate={{ width }} transition={{ delay, duration: Duration.Slow, ease: EASE_OUT }} />
    </span>
  );
}

function Rows({ slide }: { slide: Exclude<IntroSlide, 'readiness'> }) {
  const t = useTranslations(`intro.art.${slide}`);
  const keys = ['one', 'two', 'three'] as const;
  return (
    <>
      <p className="mb-2 font-heading text-lg font-semibold text-onboard-navy">{t('heading')}</p>
      {keys.map((key, index) => {
        const done = slide === 'progress' && index === 0;
        return (
          <motion.div key={key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + index * 0.08, duration: Duration.Base, ease: EASE_OUT }} className="flex items-center gap-2.5 py-2">
            <span className={cn('flex size-7 items-center justify-center rounded-lg bg-[#eff3ec] text-xs font-semibold text-onboard-navy', done && 'bg-onboard-navy text-white')}>{done ? <Icon name="check" size={14} /> : index + 1}</span>
            <span className="flex-1 text-[11px] font-medium text-onboard-navy">{t(key)}</span>
            {slide === 'matching' ? <Icon name="check" size={16} className="text-[#3d8273]" /> : null}
          </motion.div>
        );
      })}
      {slide === 'matching' ? (
        <p className="mt-2 rounded-lg bg-[#f7edcb] px-2 py-2 text-center text-[10px] font-medium text-onboard-navy">{t('pill')}</p>
      ) : (
        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-[#ebefeb]">
          <motion.span className="block h-full rounded-full bg-[#3d8273]" initial={{ width: 0 }} animate={{ width: '33%' }} transition={{ delay: 0.5, duration: Duration.Slow, ease: EASE_OUT }} />
        </span>
      )}
    </>
  );
}

export function IntroArt({ slide }: { slide: IntroSlide }) {
  const t = useTranslations('intro.art');
  return (
    <figure className="relative mx-auto flex h-[300px] w-full max-w-[340px] items-center justify-center">
      <figcaption className="sr-only">{t(`${slide}.alt`)}</figcaption>
      <motion.span className="absolute size-[280px] rounded-full border border-[#dee5dd] bg-[#eaefea]" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: Duration.Slow, ease: EASE_OUT }} />
      <motion.span className="absolute size-[235px] rounded-full border border-[#d8e2da]" animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }} />
      <motion.span className="absolute top-5 right-7 size-[18px] rounded-full bg-onboard-gold" animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.span className="absolute bottom-6 left-5 size-[9px] rounded-full bg-onboard-navy" animate={{ y: [0, 5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div initial={{ opacity: 0, y: 16, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: Duration.Slow, ease: EASE_OUT }} className="relative w-[88%] max-w-[305px] rounded-[20px] border border-[#e3e9e4] bg-white p-4 shadow-[0_14px_32px_rgba(8,44,75,0.09)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[9px] font-medium tracking-[0.1em] text-onboard-muted uppercase">{t(`${slide}.label`)}</span>
          <span className="flex size-[25px] items-center justify-center rounded-lg bg-onboard-navy text-onboard-gold">
            <Icon name="arrow-outward" size={18} />
          </span>
        </div>
        {slide === 'readiness' ? (
          <>
            <div className="flex flex-col items-center py-2">
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }} className="flex size-[74px] items-center justify-center rounded-full bg-[#f7edcb] text-onboard-navy">
                <Icon name="trending-up" size={40} />
              </motion.span>
              <p className="mt-2 font-heading text-[17px] font-semibold text-onboard-navy">{t('readiness.heading')}</p>
              <p className="text-[10px] text-onboard-muted">{t('readiness.tagline')}</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-onboard-muted">{t('readiness.cashFlow')}</span>
              <Bar width="76%" tone="green" delay={0.35} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-onboard-muted">{t('readiness.stability')}</span>
              <Bar width="58%" tone="gold" delay={0.45} />
            </div>
          </>
        ) : (
          <Rows slide={slide} />
        )}
        <p className="mt-4 text-center text-[7px] tracking-[0.1em] text-onboard-muted uppercase">{t('preview')}</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 20, y: 8 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ delay: 0.35, duration: Duration.Slow, ease: EASE_OUT }} className="absolute right-0 bottom-1 flex items-center gap-2.5 rounded-[15px] bg-onboard-navy px-3.5 py-3 shadow-[0_8px_18px_rgba(8,44,75,0.15)]">
        <span className="flex size-[34px] items-center justify-center rounded-[11px] bg-onboard-gold text-onboard-navy">
          <Icon name={CHIP_ICON[slide]} size={20} />
        </span>
        <span className="flex flex-col">
          <span className="font-heading text-[11px] font-semibold text-white">{t(`${slide}.chipTitle`)}</span>
          <span className="text-[10px] text-[#c2d1dc]">{t(`${slide}.chipBody`)}</span>
        </span>
      </motion.div>
    </figure>
  );
}
