export const INTRO_SEEN_KEY = 'ff_intro_seen';

export const SPLASH_SEEN_KEY = 'ff_splash_seen';

export const SPLASH_DURATION_MS = 1600;

export const INTRO_SLIDES = ['readiness', 'matching', 'progress'] as const;

export type IntroSlide = (typeof INTRO_SLIDES)[number];

export const SWIPE_THRESHOLD_PX = 65;
