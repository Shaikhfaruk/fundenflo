import type { z } from 'zod';

import type { ImportKind } from '../../../common/enums/db.enums.js';

export type ImportFieldSpec = { key: string; label: string; description: string };

export type ImportRowIssue = { field: string; column: string | null; code: string; message: string };

export type MappedRow<TInput> = { input: TInput | null; errors: ImportRowIssue[]; warnings: string[]; dedupeKey: string | null };

export type ImportRowContext<TDefaults> = { batchId: string; rowNumber: number; defaults: TDefaults; actorUserId: string | null };

export interface ImportHandler<TDefaults = unknown, TInput = unknown> {
  readonly kind: ImportKind;
  readonly fields: ImportFieldSpec[];
  readonly defaultsSchema: z.ZodType<TDefaults>;
  checkDefaults(defaults: TDefaults): Promise<ImportRowIssue[]>;
  mapRow(values: Record<string, string>, mapping: Record<string, string>, defaults: TDefaults): Promise<MappedRow<TInput>>;
  commitRow(input: TInput, context: ImportRowContext<TDefaults>): Promise<{ entityId: string }>;
  undoRow(entityId: string, context: ImportRowContext<TDefaults>): Promise<boolean>;
}
