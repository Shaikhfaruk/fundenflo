import { ConfigVersionStatus } from '../../../common/enums/db.enums.js';

export type VersionTiming = { status: ConfigVersionStatus; number: number; effectiveFrom: Date | null };

export function pickActiveVersion<T extends VersionTiming>(versions: readonly T[], now: Date): T | undefined {
  let active: T | undefined;
  for (const version of versions) {
    if (version.status !== ConfigVersionStatus.published || !version.effectiveFrom || version.effectiveFrom > now) continue;
    if (!active?.effectiveFrom) {
      active = version;
      continue;
    }
    const later = version.effectiveFrom.getTime() - active.effectiveFrom.getTime();
    if (later > 0 || (later === 0 && version.number > active.number)) active = version;
  }
  return active;
}
