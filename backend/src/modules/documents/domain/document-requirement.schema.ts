import { z } from 'zod';

import { localisedLongTextSchema, localisedTextSchema } from '../../../common/i18n/locale.js';
import type { Condition } from '../../../engines/conditions/condition.types.js';
import type { CompiledDocumentRequirement } from '../../../engines/documents/documents.types.js';
import { DOCUMENT_KEY_PATTERN, DOCUMENT_SLOTS_MAX, DOCUMENT_TYPES_PER_SLOT_MAX, DocumentStage } from './document.constants.js';

const key = z.string().regex(DOCUMENT_KEY_PATTERN);
const scopeKeys = z.array(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)).min(1).max(50);

export const documentSlotSchema = z
  .object({
    key,
    documentTypes: z.array(key).min(1).max(DOCUMENT_TYPES_PER_SLOT_MAX),
    required: z.boolean().default(true),
    minCount: z.number().int().min(1).max(24).default(1),
    when: z.unknown().optional(),
    label: localisedTextSchema.optional(),
    description: localisedLongTextSchema.optional(),
  })
  .strict();

export const documentRequirementContentSchema = z
  .object({
    stage: z.enum(Object.values(DocumentStage)),
    scope: z.object({ segments: scopeKeys.optional(), subSegments: scopeKeys.optional(), categories: scopeKeys.optional() }).strict().default({}),
    items: z.array(documentSlotSchema).min(1).max(DOCUMENT_SLOTS_MAX),
  })
  .strict()
  .refine((content) => new Set(content.items.map((item) => item.key)).size === content.items.length, { path: ['items'], message: 'slot keys must be unique' });

export type DocumentRequirementContent = z.output<typeof documentRequirementContentSchema>;

export const toCompiledRequirement = (requirement: DocumentRequirementContent): CompiledDocumentRequirement => ({
  stage: requirement.stage,
  scope: requirement.scope,
  items: requirement.items.map((item) => ({ key: item.key, documentTypes: item.documentTypes, required: item.required, minCount: item.minCount, when: (item.when as Condition | undefined) ?? null, label: item.label ?? null, description: item.description ?? null })),
});
