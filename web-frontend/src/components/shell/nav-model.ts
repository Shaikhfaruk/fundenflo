import { CONTEXT_AREA, MAX_PRIMARY_TABS, NAVIGATION, type NavArea, type NavGroup, type NavItem, ShellArea } from '@/lib/constants/navigation.constants';
import type { MeView } from '@/lib/api/types/auth.types';

export const resolveArea = (area: ShellArea, me: MeView | undefined): NavArea => (area === ShellArea.Account ? (CONTEXT_AREA[me?.activeContext?.context ?? 'none'] ?? 'none') : area);

export function navigationFor(area: NavArea, role: string | undefined): NavGroup[] {
  return NAVIGATION[area]
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role))) }))
    .filter((group) => group.items.length > 0);
}

export const primaryTabs = (groups: NavGroup[]) => groups.flatMap((group) => group.items).filter((item) => item.primary).slice(0, MAX_PRIMARY_TABS);

export function activeHref(items: NavItem[], pathname: string): string | null {
  const matches = items.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matches.toSorted((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}
