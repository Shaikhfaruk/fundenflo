import { z } from 'zod';

import { CatalogStatus, DataSensitivity } from '../../../common/enums/db.enums.js';
import { localisedLongTextSchema, localisedTextSchema } from '../../../common/i18n/locale.js';
import { DOCUMENT_KEY_PATTERN, DOCUMENT_MAX_SIZE_BYTES, DOCUMENT_MIME_TYPES, DOCUMENT_PERIOD_RULES, DocumentStage } from '../domain/document.constants.js';

const typeShape = {
  label: localisedTextSchema,
  description: localisedLongTextSchema.optional(),
  icon: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/).optional(),
  acceptedMimeTypes: z.array(z.enum(DOCUMENT_MIME_TYPES)).min(1).max(DOCUMENT_MIME_TYPES.length),
  maxSizeBytes: z.number().int().min(1).max(DOCUMENT_MAX_SIZE_BYTES),
  periodRule: z.enum(DOCUMENT_PERIOD_RULES).optional(),
  freshnessDays: z.number().int().min(1).max(3650).optional(),
  extractorKey: z.string().regex(DOCUMENT_KEY_PATTERN).optional(),
  producesAttributes: z.array(z.string().min(3).max(100)).max(50).optional(),
  retentionDays: z.number().int().min(1).max(36500).optional(),
  sensitivity: z.enum(Object.values(DataSensitivity)),
};

export const createDocumentTypeSchema = z.object({ key: z.string().regex(DOCUMENT_KEY_PATTERN), ...typeShape }).strict();
export type CreateDocumentTypeDto = z.output<typeof createDocumentTypeSchema>;

export const updateDocumentTypeSchema = z
  .object({ ...typeShape, label: localisedTextSchema.optional(), description: localisedLongTextSchema.nullable().optional(), acceptedMimeTypes: typeShape.acceptedMimeTypes.optional(), maxSizeBytes: typeShape.maxSizeBytes.optional(), sensitivity: typeShape.sensitivity.optional(), status: z.enum(Object.values(CatalogStatus)).optional() })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'send at least one field');
export type UpdateDocumentTypeDto = z.output<typeof updateDocumentTypeSchema>;

export const listDocumentTypesSchema = z.object({ status: z.enum(Object.values(CatalogStatus)).optional() });
export type ListDocumentTypesDto = z.output<typeof listDocumentTypesSchema>;

const factPair = z.string().regex(/^[a-z][a-z0-9_.]{2,99}:.{1,100}$/, 'use attribute.key:value');

export const checklistQuerySchema = z.object({
  stage: z.enum(Object.values(DocumentStage)).default(DocumentStage.Assessment),
  segment: z.string().max(64).optional(),
  subSegment: z.string().max(64).optional(),
  category: z.string().max(64).optional(),
  fact: z.union([factPair, z.array(factPair).max(20)]).transform((value) => (Array.isArray(value) ? value : [value])).optional(),
});
export type ChecklistQuery = z.output<typeof checklistQuerySchema>;
