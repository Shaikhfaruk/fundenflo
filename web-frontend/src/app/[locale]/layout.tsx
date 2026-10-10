import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';
import { notFound } from 'next/navigation';

import '../globals.css';
import { AppProviders } from '@/components/providers/app-providers';
import { routing } from '@/i18n/routing';
import { fontVariables } from '@/lib/fonts/fonts';
import { APP_NAME, THEME_COLOR } from '@/lib/constants/pwa.constants';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t('description'),
    applicationName: APP_NAME,
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
    formatDetection: { telephone: false },
    icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/favicon.svg', type: 'image/svg+xml' }], apple: '/icons/apple-touch-icon.png' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.dark },
  ],
};

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning className={fontVariables}>
      <body className="min-h-dvh">
        <NextIntlClientProvider messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
