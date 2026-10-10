import { ACCESS_REFRESH_LEEWAY_MS, SessionCookie } from '@/lib/constants/session.constants';

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
};

export const sessionExpiresAt = (): number | null => {
  const value = readCookie(SessionCookie.ExpiresAt);
  return value ? Number(value) : null;
};

export const hasSession = () => sessionExpiresAt() !== null;

export const sessionContext = (): string | null => readCookie(SessionCookie.Context);

export const accessNeedsRefresh = () => {
  const expiresAt = sessionExpiresAt();
  return expiresAt !== null && expiresAt - Date.now() < ACCESS_REFRESH_LEEWAY_MS;
};
