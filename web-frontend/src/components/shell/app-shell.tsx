'use client';

import type { ReactNode } from 'react';

import { AreaGuard } from '@/components/shell/area-guard';
import { BorrowerShell } from '@/components/shell/borrower-shell';
import { navigationFor, primaryTabs, resolveArea } from '@/components/shell/nav-model';
import { PortalShell } from '@/components/shell/portal-shell';
import { CONTEXT_AREA, PORTAL_AREAS, ShellArea } from '@/lib/constants/navigation.constants';
import { useMe } from '@/lib/session/use-me';
import { useSessionContext } from '@/lib/session/use-session-context';

export function AppShell({ area, children }: { area: ShellArea; children: ReactNode }) {
  const { data: me, isPending } = useMe();
  const cookieContext = useSessionContext();
  const navArea = me ? resolveArea(area, me) : area === ShellArea.Account ? (CONTEXT_AREA[cookieContext ?? 'none'] ?? 'none') : area;
  const groups = navigationFor(navArea, me?.activeContext?.role);
  const content = (
    <AreaGuard area={area} me={me} loading={isPending}>
      {children}
    </AreaGuard>
  );
  if (PORTAL_AREAS.includes(navArea)) {
    return (
      <PortalShell area={navArea} me={me} groups={groups}>
        {content}
      </PortalShell>
    );
  }
  return (
    <BorrowerShell me={me} tabs={primaryTabs(groups)}>
      {content}
    </BorrowerShell>
  );
}
