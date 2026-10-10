import type { MetadataRoute } from 'next';

import { APP_NAME, THEME_COLOR } from '@/lib/constants/pwa.constants';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: `${APP_NAME} — loans made ready`,
    short_name: APP_NAME,
    description: 'Get loan-ready, match with the right lenders and track every application in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    categories: ['finance', 'business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
