import { accessibleBy } from '@casl/prisma/runtime';

import { AssignmentStatus } from '../../../common/enums/db.enums.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { SyncSourceFor } from '../../sync/application/sync-source.registry.js';
import { changedAfter } from '../../sync/domain/sync-cursor.js';
import { type SyncCursor, type SyncScope, type SyncSource, SyncType } from '../../sync/domain/sync.types.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';

const HELD: AssignmentStatus[] = [AssignmentStatus.offered, AssignmentStatus.accepted, AssignmentStatus.working, AssignmentStatus.completed];

@SyncSourceFor(SyncType.Lead)
export class LeadSyncSource implements SyncSource {
  constructor(private readonly leads: LeadRepository) {}

  async changes({ ability }: SyncScope, after: SyncCursor | null, limit: number) {
    const scope = ability.can(AppAction.Read, 'Lead')
      ? accessibleBy(ability, AppAction.Read).ofType('Lead')
      : { assignments: { some: { AND: [accessibleBy(ability, AppAction.Read).ofType('LeadAssignment'), { status: { in: HELD } }] } } };
    const rows = ability.can(AppAction.Read, 'Lead') || ability.can(AppAction.Read, 'LeadAssignment') ? await this.leads.syncLeads({ AND: [scope, changedAfter(SyncType.Lead, after)] }, limit) : [];
    return rows.map((row) => ({ type: SyncType.Lead, ...row }));
  }
}

@SyncSourceFor(SyncType.Assignment)
export class AssignmentSyncSource implements SyncSource {
  constructor(private readonly leads: LeadRepository) {}

  async changes({ ability }: SyncScope, after: SyncCursor | null, limit: number) {
    if (!ability.can(AppAction.Read, 'LeadAssignment')) return [];
    const rows = await this.leads.syncAssignments({ AND: [accessibleBy(ability, AppAction.Read).ofType('LeadAssignment'), changedAfter(SyncType.Assignment, after)] }, limit);
    return rows.map((row) => ({ type: SyncType.Assignment, ...row }));
  }
}
