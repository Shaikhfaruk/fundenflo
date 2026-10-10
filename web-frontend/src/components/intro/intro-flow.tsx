'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { IntroArt } from '@/components/intro/intro-art';
import { Icon } from '@/components/ui/icon';
import { useRouter } from '@/i18n/navigation';
import { INTRO_SEEN_KEY, INTRO_SLIDES, SPLASH_DURATION_MS, SPLASH_SEEN_KEY, SWIPE_THRESHOLD_PX } from '@/lib/constants/intro.constants';
import { Duration, EASE_OUT, SOFT_SPRING } from '@/lib/constants/motion.constants';
import { AppPath, HOME_BY_CONTEXT } from '@/lib/constants/routes.constants';
import { hasSession, sessionContext } from '@/lib/session/session-cookie';
import { cn } from '@/lib/utils';

type Stage = 'splash' | 'slides';

const read = (storage: () => Storage, key: string) => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};

const write = (storage: () => Storage, key: string) => {
  try {
    storage().setItem(key, '1');
  } catch {
    return;
  }
};

const LAST = INTRO_SLIDES.length - 1;

function Splash() {
  const t = useTranslations('intro');
  return (
    <motion.div key="splash" exit={{ opacity: 0 }} transition={{ duration: Duration.Base }} className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-onboard-navy safe-top safe-bottom">
      <motion.span className="absolute size-[520px] rounded-full border border-[#17415f]" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.2, ease: EASE_OUT }} aria-hidden="true" />
      <motion.span className="absolute size-[760px] rounded-full border border-[#17415f]/50" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.1 }} aria-hidden="true" />
      <div className="relative flex w-full flex-col items-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="w-full max-w-[340px]">
          <Logo inverse height={74} priority className="mx-auto" />
        </motion.div>
        <motion.span className="mt-4 h-[3px] rounded-full bg-onboard-gold" initial={{ width: 0 }} animate={{ width: 40 }} transition={{ delay: 0.45, duration: 0.5, ease: EASE_OUT }} aria-hidden="true" />
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: Duration.Slow, ease: EASE_OUT }} className="mt-4 text-sm text-[#d8e2ea]">
          {t('splashMessage')}
        </motion.p>
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: Duration.Slow }} className="absolute bottom-12 text-[9px] tracking-[0.22em] text-[#b2c3d1] uppercase">
        {t('splashFooter')}
      </motion.p>
    </motion.div>
  );
}

export function IntroFlow() {
  const t = useTranslations('intro');
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('splash');
  const [[page, direction], setPage] = useState<[number, number]>([0, 0]);
  const swipeX = useRef<number | null>(null);
  const slide = INTRO_SLIDES[page];

  useEffect(() => {
    const seenSplash = read(() => window.sessionStorage, SPLASH_SEEN_KEY) !== null;
    const timer = window.setTimeout(
      () => {
        write(() => window.sessionStorage, SPLASH_SEEN_KEY);
        if (hasSession()) router.replace(HOME_BY_CONTEXT[sessionContext() ?? ''] ?? AppPath.AccountSwitch);
        else if (read(() => window.localStorage, INTRO_SEEN_KEY) !== null) router.replace(AppPath.Login);
        else setStage('slides');
      },
      seenSplash ? 0 : SPLASH_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (stage !== 'slides') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setPage(([current]) => [Math.min(LAST, current + 1), 1]);
      if (event.key === 'ArrowLeft') setPage(([current]) => [Math.max(0, current - 1), -1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  const go = (next: number) => setPage(([current]) => [Math.max(0, Math.min(LAST, next)), next > current ? 1 : -1]);
  const finish = () => {
    write(() => window.localStorage, INTRO_SEEN_KEY);
    router.push(AppPath.Login);
  };

  return (
    <>
      <AnimatePresence>{stage === 'splash' ? <Splash /> : null}</AnimatePresence>
      {stage === 'slides' ? (
        <div className="flex min-h-dvh flex-col bg-onboard-canvas safe-top safe-bottom lg:items-center lg:justify-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: Duration.Slow, ease: EASE_OUT }} className="mx-auto flex w-full max-w-[500px] flex-1 flex-col px-4 lg:my-4 lg:max-h-[880px] lg:flex-none lg:rounded-[28px] lg:border lg:border-[#e4e5df] lg:shadow-float">
            <header className="flex items-center justify-between pt-4 pb-4">
              <Logo height={34} priority />
              <button type="button" onClick={finish} className="flex min-h-11 items-center gap-1 text-xs text-onboard-muted hover:text-onboard-navy">
                {t('skip')}
                <Icon name="arrow-outward" size={14} />
              </button>
            </header>
            <main
              id="main"
              className="flex flex-1 touch-pan-y flex-col justify-center overflow-hidden"
              onPointerDown={(event) => {
                swipeX.current = event.clientX;
              }}
              onPointerUp={(event) => {
                if (swipeX.current === null) return;
                const dx = event.clientX - swipeX.current;
                swipeX.current = null;
                if (Math.abs(dx) > SWIPE_THRESHOLD_PX) go(page + (dx < 0 ? 1 : -1));
              }}
            >
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.section
                  key={slide}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -40 }}
                  transition={{ duration: Duration.Base, ease: EASE_OUT }}
                  aria-roledescription="slide"
                  aria-label={t('slideOf', { current: page + 1, total: INTRO_SLIDES.length })}
                >
                  <p className="flex items-center justify-center gap-2 text-[10px] tracking-[0.18em] text-onboard-muted uppercase">
                    <span className="size-1.5 rounded-full bg-[#b58a23]" aria-hidden="true" />
                    {t(`slides.${slide}.tag`)}
                  </p>
                  <div className="my-3">
                    <IntroArt slide={slide} />
                  </div>
                  <h1 className="mt-4 font-heading text-[29px] leading-[39px] font-semibold tracking-[-0.02em] whitespace-pre-line text-onboard-navy">{t(`slides.${slide}.title`)}</h1>
                  <p className="mt-3 font-heading text-sm font-medium text-[#9a7218]">{t(`slides.${slide}.accent`)}</p>
                  <p className="mt-2 text-sm leading-[23px] text-onboard-muted">{t(`slides.${slide}.body`)}</p>
                </motion.section>
              </AnimatePresence>
            </main>
            <footer className="pt-3 pb-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center">
                  {INTRO_SLIDES.map((key, index) => (
                    <button key={key} type="button" onClick={() => go(index)} aria-label={t('goToSlide', { number: index + 1 })} aria-current={page === index ? 'step' : undefined} className="flex h-8 min-w-7 items-center justify-center">
                      <motion.span layout transition={SOFT_SPRING} className={cn('h-1.5 rounded-full bg-[#cdd4d6]', page === index ? 'w-[26px] bg-onboard-navy' : 'w-1.5')} />
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-onboard-navy tabular">
                  {String(page + 1).padStart(2, '0')}
                  <span className="text-[#9ca5ab]"> / {String(INTRO_SLIDES.length).padStart(2, '0')}</span>
                </p>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => (page < LAST ? go(page + 1) : finish())}
                className="flex min-h-[58px] w-full items-center justify-between rounded-2xl bg-onboard-navy px-4 font-heading text-sm font-semibold text-white shadow-[0_10px_24px_rgba(8,44,75,0.22)] transition-colors hover:bg-[#0b3a63]"
              >
                <span>{page === LAST ? t('start') : t('continue')}</span>
                <motion.span animate={{ x: [0, 3, 0], y: [0, -3, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} className="flex text-onboard-gold">
                  <Icon name="arrow-outward" size={24} />
                </motion.span>
              </motion.button>
              <div className="flex min-h-[42px] items-center justify-between">
                {page > 0 ? (
                  <button type="button" onClick={() => go(page - 1)} className="flex items-center gap-1 text-xs text-onboard-navy">
                    <Icon name="arrow-back" size={14} />
                    {t('back')}
                  </button>
                ) : (
                  <span className="text-[9px] text-onboard-muted">{t('madeFor')}</span>
                )}
                <span className="text-[9px] text-onboard-muted">{t('clearerWay')}</span>
              </div>
              <p className="text-center text-[9px] leading-[14px] text-onboard-muted">{t(`slides.${slide}.note`)}</p>
            </footer>
          </motion.div>
        </div>
      ) : null}
    </>
  );
}
