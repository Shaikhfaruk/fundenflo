import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import { AppPath, NEXT_PARAM, ProtectedArea, STAFF_SIGN_IN_AREAS } from '@/lib/constants/routes.constants';
import { SessionCookie } from '@/lib/constants/session.constants';

const intl = createMiddleware(routing);

const AREAS: readonly string[] = Object.values(ProtectedArea);

const localeOf = (pathname: string) => routing.locales.find((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const locale = localeOf(pathname);
  const bare = locale ? pathname.slice(locale.length + 1) || '/' : pathname;
  const area = AREAS.find((prefix) => bare === prefix || bare.startsWith(`${prefix}/`));
  if (area && !request.cookies.get(SessionCookie.ExpiresAt)) {
    const signIn = STAFF_SIGN_IN_AREAS.includes(area) ? AppPath.StaffLogin : AppPath.Login;
    const prefix = locale !== undefined && locale !== routing.defaultLocale ? `/${String(locale)}` : '';
    const target = new URL(`${prefix}${signIn}`, request.url);
    target.searchParams.set(NEXT_PARAM, `${bare}${search}`);
    return NextResponse.redirect(target);
  }
  return intl(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
