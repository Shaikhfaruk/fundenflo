import { z } from 'zod';

import { AttributeDataType, AttributeSubject, CatalogStatus, DataSensitivity, FactProvenance } from '../../../common/enums/db.enums.js';
import { localisedTextSchema } from '../../../common/i18n/locale.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { ATTRIBUTE_KEY_PATTERN, MAX_ENUM_VALUES, MAX_FACTS_PER_WRITE } from '../domain/attribute.constants.js';

export const attributeKeySchema = z.string().trim().regex(ATTRIBUTE_KEY_PATTERN, 'use a namespaced key such as business.vintage_months');

const enumOptionSchema = z.object({ value: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/), label: localisedTextSchema }).strict();
const provenanceListSchema = z.array(z.enum(Object.values(FactProvenance))).min(1);

export const createAttributeSchema = z
  .object({
    key: attributeKeySchema,
    label: localisedTextSchema,
    description: localisedTextSchema.optional(),
    dataType: z.enum(Object.values(AttributeDataType)),
    unit: z.string().trim().min(1).max(30).optional(),
    enumValues: z.array(enumOptionSchema).min(1).max(MAX_ENUM_VALUES).optional(),
    subject: z.enum(Object.values(AttributeSubject)),
    sensitivity: z.enum(Object.values(DataSensitivity)),
    allowedProvenance: provenanceListSchema,
    freshnessDays: z.number().int().min(1).max(3_650).optional(),
  })
  .strict();
export type CreateAttributeDto = z.output<typeof createAttributeSchema>;

export const updateAttributeSchema = z
  .object({
    label: localisedTextSchema.optional(),
    description: localisedTextSchema.nullable().optional(),
    unit: z.string().trim().min(1).max(30).nullable().optional(),
    enumValues: z.array(enumOptionSchema).min(1).max(MAX_ENUM_VALUES).optional(),
    sensitivity: z.enum(Object.values(DataSensitivity)).optional(),
    allowedProvenance: provenanceListSchema.optional(),
    freshnessDays: z.number().int().min(1).max(3_650).nullable().optional(),
    status: z.enum(Object.values(CatalogStatus)).optional(),
  })
  .strict();
export type UpdateAttributeDto = z.output<typeof updateAttributeSchema>;

export const listAttributesSchema = z.object({
  status: z.enum(Object.values(CatalogStatus)).optional(),
  subject: z.enum(Object.values(AttributeSubject)).optional(),
});
export type ListAttributesQuery = z.output<typeof listAttributesSchema>;

export const validateConditionSchema = z.object({ condition: z.unknown() }).strict();
export type ValidateConditionDto = z.output<typeof validateConditionSchema>;

export const evaluateConditionSchema = z
  .object({
    condition: z.unknown(),
    partyId: z.uuid().optional(),
    facts: z.record(attributeKeySchema, z.unknown()).optional(),
  })
  .strict();
export type EvaluateConditionDto = z.output<typeof evaluateConditionSchema>;

export const recordFactsSchema = z
  .object({
    facts: z
      .array(
        z
          .object({
            attributeKey: attributeKeySchema,
            value: z.unknown(),
            confidence: z.number().min(0).max(1).optional(),
            observedAt: z.coerce.date().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_FACTS_PER_WRITE),
    note: z.string().trim().min(3).max(500),
  })
  .strict();
export type RecordFactsDto = z.output<typeof recordFactsSchema>;

export const factHistorySchema = pageQuerySchema.extend({ attributeKey: attributeKeySchema.optional() });
export type FactHistoryQuery = z.output<typeof factHistorySchema>;
