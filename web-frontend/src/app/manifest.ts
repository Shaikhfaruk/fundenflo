import type { MetadataRoute } from 'next';

import { APP_NAME, APP_TAGLINE, BRAND_COLOR } from '@/lib/constants/pwa.constants';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: `${APP_NAME} — ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description: 'Get loan-ready, match with the right lenders and track every application in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BRAND_COLOR.navy,
    theme_color: BRAND_COLOR.navy,
    categories: ['finance', 'business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
