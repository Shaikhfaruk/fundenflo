export type MergeIssue = { path: string; code: string; message: string };

export type MergeParties = { sourceId: string; targetId: string };

export interface PartyMergeParticipant {
  check?(parties: MergeParties): Promise<MergeIssue[]>;
  merge(parties: MergeParties): Promise<unknown>;
  revert(parties: MergeParties, undo: unknown): Promise<void>;
}

export const movedIds = (undo: unknown, field: string): string[] => {
  const value = (undo as Record<string, unknown> | null)?.[field];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};
