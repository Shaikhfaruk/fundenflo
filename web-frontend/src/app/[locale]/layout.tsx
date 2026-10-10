import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';
import { notFound } from 'next/navigation';

import '../globals.css';
import { AppProviders } from '@/components/providers/app-providers';
import { routing } from '@/i18n/routing';
import { fontVariables } from '@/lib/fonts/fonts';
import { APP_NAME, BRAND_COLOR } from '@/lib/constants/pwa.constants';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t('description'),
    applicationName: APP_NAME,
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    icons: { icon: [{ url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/icons/apple-touch-icon.png' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: BRAND_COLOR.canvas,
  colorScheme: 'light',
};

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = await getMessages();
  return (
    <html lang={locale} className={fontVariables}>
      <body className="min-h-dvh">
        <NextIntlClientProvider messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
