export type ConsentEvent = {
  id: string;
  granted: boolean;
  organizationIds: string[] | null;
  recordedAt: Date;
  expiresAt: Date | null;
};

export type ConsentState = {
  granted: boolean;
  everyOrganization: boolean;
  organizationIds: string[];
  excludedOrganizationIds: string[];
  lastEventId: string | null;
  lastChangedAt: Date | null;
  expiresAt: Date | null;
};

export function foldConsent(events: readonly ConsentEvent[], now: Date): ConsentState {
  let every = false;
  let expiresAt: Date | null = null;
  let last: ConsentEvent | null = null;
  const organizations = new Set<string>();
  const excluded = new Set<string>();
  for (const event of events.toSorted((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())) {
    if (event.granted) {
      if (event.expiresAt && event.expiresAt <= now) continue;
      if (event.organizationIds === null) {
        every = true;
        excluded.clear();
      } else {
        for (const id of event.organizationIds) {
          organizations.add(id);
          excluded.delete(id);
        }
      }
      expiresAt = event.expiresAt;
    } else if (event.organizationIds === null) {
      every = false;
      organizations.clear();
      excluded.clear();
      expiresAt = null;
    } else {
      for (const id of event.organizationIds) {
        organizations.delete(id);
        if (every) excluded.add(id);
      }
    }
    last = event;
  }
  const granted = every || organizations.size > 0;
  return {
    granted,
    everyOrganization: every,
    organizationIds: [...organizations].toSorted(),
    excludedOrganizationIds: [...excluded].toSorted(),
    lastEventId: last?.id ?? null,
    lastChangedAt: last?.recordedAt ?? null,
    expiresAt: granted ? expiresAt : null,
  };
}

export function consentAllows(state: ConsentState, organizationId?: string, options: { explicitOnly?: boolean } = {}): boolean {
  if (!state.granted) return false;
  if (!organizationId) return true;
  if (state.organizationIds.includes(organizationId)) return true;
  return !options.explicitOnly && state.everyOrganization && !state.excludedOrganizationIds.includes(organizationId);
}
