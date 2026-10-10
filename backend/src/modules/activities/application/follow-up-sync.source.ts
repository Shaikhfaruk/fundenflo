import { accessibleBy } from '@casl/prisma/runtime';

import { AppAction } from '../../access/domain/ability.types.js';
import { SyncSourceFor } from '../../sync/application/sync-source.registry.js';
import { changedAfter } from '../../sync/domain/sync-cursor.js';
import { type SyncCursor, type SyncScope, type SyncSource, SyncType } from '../../sync/domain/sync.types.js';
import { ActivityRepository } from '../infrastructure/activity.repository.js';

@SyncSourceFor(SyncType.FollowUp)
export class FollowUpSyncSource implements SyncSource {
  constructor(private readonly activities: ActivityRepository) {}

  async changes({ ability }: SyncScope, after: SyncCursor | null, limit: number) {
    if (!ability.can(AppAction.Read, 'FollowUp')) return [];
    const rows = await this.activities.syncFollowUps({ AND: [accessibleBy(ability, AppAction.Read).ofType('FollowUp'), changedAfter(SyncType.FollowUp, after)] }, limit);
    return rows.map((row) => ({ type: SyncType.FollowUp, ...row }));
  }
}
