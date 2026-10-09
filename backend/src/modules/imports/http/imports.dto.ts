import { z } from 'zod';

import { ImportKind, ImportRowStatus, ImportStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';

export const importKindSchema = z.enum(Object.values(ImportKind));

export const createImportSchema = z.object({ kind: importKindSchema, fileName: z.string().trim().min(3).max(200) }).strict();
export type CreateImportDto = z.output<typeof createImportSchema>;

export const listImportsSchema = pageQuerySchema.extend({ kind: importKindSchema.optional(), status: z.enum(Object.values(ImportStatus)).optional() });
export type ListImportsQuery = z.output<typeof listImportsSchema>;

export const importMappingSchema = z
  .object({
    mapping: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/), z.string().min(1).max(200)).refine((value) => Object.keys(value).length > 0, 'map at least one field'),
    defaults: z.unknown().default({}),
  })
  .strict();
export type ImportMappingDto = z.output<typeof importMappingSchema>;

const rowStatus = z.enum([ImportRowStatus.invalid, ImportRowStatus.failed, ImportRowStatus.valid, ImportRowStatus.committed, ImportRowStatus.undone, ImportRowStatus.kept]);

export const importRowsSchema = pageQuerySchema.extend({
  status: z.union([rowStatus, z.array(rowStatus)]).transform((value) => (Array.isArray(value) ? value : [value])).optional(),
});
export type ImportRowsQuery = z.output<typeof importRowsSchema>;
