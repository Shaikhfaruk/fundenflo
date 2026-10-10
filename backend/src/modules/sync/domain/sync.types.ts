import type { UserActor } from '../../../common/context/actor.js';
import type { AppAbility } from '../../access/domain/ability.types.js';

export const SYNC_SOURCE_METADATA = 'sync:source';

export const SyncType = {
  Assignment: 'assignment',
  FollowUp: 'follow_up',
  Lead: 'lead',
} as const;

export type SyncType = (typeof SyncType)[keyof typeof SyncType];

export const SYNC_MAX_LIMIT = 500;

export const SYNC_DEFAULT_LIMIT = 200;

export type SyncCursor = { at: Date; type: SyncType; id: string };

export type SyncChange = { type: SyncType; id: string; version: number; updatedAt: Date };

export type SyncScope = { ability: AppAbility; actor: UserActor };

export interface SyncSource {
  changes(scope: SyncScope, after: SyncCursor | null, limit: number): Promise<SyncChange[]>;
}
