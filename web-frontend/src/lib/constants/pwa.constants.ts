export const SERVICE_WORKER_URL = `/sw.js?v=${process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}`;

export const SwMessage = {
  SkipWaiting: 'SKIP_WAITING',
} as const;

export const THEME_COLOR = { light: '#f7faf8', dark: '#0f1613' } as const;

export const APP_NAME = 'FundenFlo';
