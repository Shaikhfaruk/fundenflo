import { ArrowLeftRight, FilePlus2, FileStack, House, Inbox, LayoutDashboard, type LucideIcon, UserRound, UserRoundCog } from 'lucide-react';

import { NavIcon } from '@/lib/constants/navigation.constants';

const ICONS: Record<NavIcon, LucideIcon> = {
  [NavIcon.Home]: House,
  [NavIcon.NewApplication]: FilePlus2,
  [NavIcon.Profile]: UserRound,
  [NavIcon.Dashboard]: LayoutDashboard,
  [NavIcon.Leads]: Inbox,
  [NavIcon.Submissions]: FileStack,
  [NavIcon.SwitchRole]: ArrowLeftRight,
  [NavIcon.Account]: UserRoundCog,
};

export function NavIconGlyph({ icon, className }: { icon: NavIcon; className?: string }) {
  const Glyph = ICONS[icon];
  return <Glyph className={className} aria-hidden="true" />;
}
