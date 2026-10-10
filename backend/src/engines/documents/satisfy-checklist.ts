import type { DocumentSlot } from './documents.types.js';

export type HeldDocument = { id: string; documentType: string; freshUntil: Date | null };

export type SlotSatisfaction = { key: string; satisfied: boolean; count: number; documentIds: string[] };

export function satisfyChecklist(slots: ReadonlyArray<Pick<DocumentSlot, 'key' | 'documentTypes' | 'minCount'>>, documents: readonly HeldDocument[], now = new Date()): Map<string, SlotSatisfaction> {
  const fresh = documents.filter((document) => document.freshUntil === null || document.freshUntil >= now);
  return new Map(
    slots.map((slot) => {
      const documentIds = fresh.filter((document) => slot.documentTypes.includes(document.documentType)).map((document) => document.id);
      return [slot.key, { key: slot.key, satisfied: documentIds.length >= Math.max(1, slot.minCount), count: documentIds.length, documentIds }];
    }),
  );
}
