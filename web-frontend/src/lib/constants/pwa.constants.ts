export const SERVICE_WORKER_URL = `/sw.js?v=${process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}`;

export const SwMessage = {
  SkipWaiting: 'SKIP_WAITING',
} as const;

export const BRAND_COLOR = { navy: '#0a192f', canvas: '#f8fbff' } as const;

export const APP_NAME = 'FundenFlo';

export const APP_TAGLINE = 'The Right Funding, At The Right Time';

export const BRAND_ASSET = {
  logo: '/brand/logo.webp',
  logoWhite: '/brand/logo-white.webp',
  mark: '/brand/mark.png',
} as const;

export const LOGO_ASPECT = { logo: 1200 / 263, logoWhite: 1200 / 264 } as const;
