import { z } from 'zod';

import { AliasKind, CatalogStatus } from '../../../common/enums/db.enums.js';
import { localisedTextSchema } from '../../../common/i18n/locale.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../common/constants/listing.constants.js';
import {
  CATALOG_KEY_PATTERN,
  CITY_SEARCH_MIN_LENGTH,
  GST_STATE_CODE_PATTERN,
  MAX_TENURE_MONTHS,
  PINCODE_PATTERN,
} from '../domain/catalog.constants.js';

const keySchema = z.string().trim().regex(CATALOG_KEY_PATTERN, 'use 2-41 lowercase letters, digits, hyphens or underscores, starting with a letter');
const statusSchema = z.enum(Object.values(CatalogStatus));
const paiseSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const tenuresSchema = z.array(z.number().int().min(1).max(MAX_TENURE_MONTHS)).min(1).max(24);
const sortOrderSchema = z.number().int().min(0).max(10_000);
const iconSchema = z.string().trim().min(1).max(60);

export const gstStateCodeSchema = z.string().regex(GST_STATE_CODE_PATTERN, 'must be a 2-digit GST state code');
export const pincodeSchema = z.string().regex(PINCODE_PATTERN, 'must be a 6-digit Indian pincode');

export const categoriesQuerySchema = z.object({
  segment: keySchema.optional(),
  pincode: pincodeSchema.optional(),
  locale: z.string().optional(),
});
export type CategoriesQuery = z.output<typeof categoriesQuerySchema>;

export const citySearchSchema = z.object({
  q: z.string().trim().min(CITY_SEARCH_MIN_LENGTH).max(80),
  state: gstStateCodeSchema.optional(),
});
export type CitySearchQuery = z.output<typeof citySearchSchema>;

export const createSegmentSchema = z
  .object({ key: keySchema, label: localisedTextSchema, description: localisedTextSchema.optional(), icon: iconSchema.optional(), sortOrder: sortOrderSchema.optional() })
  .strict();
export type CreateSegmentDto = z.output<typeof createSegmentSchema>;

export const updateSegmentSchema = z
  .object({ label: localisedTextSchema.optional(), description: localisedTextSchema.nullable().optional(), icon: iconSchema.nullable().optional(), sortOrder: sortOrderSchema.optional(), status: statusSchema.optional() })
  .strict();
export type UpdateSegmentDto = z.output<typeof updateSegmentSchema>;

export const createSubSegmentSchema = z.object({ key: keySchema, label: localisedTextSchema, sortOrder: sortOrderSchema.optional() }).strict();
export type CreateSubSegmentDto = z.output<typeof createSubSegmentSchema>;

export const updateSubSegmentSchema = z.object({ label: localisedTextSchema.optional(), sortOrder: sortOrderSchema.optional(), status: statusSchema.optional() }).strict();
export type UpdateSubSegmentDto = z.output<typeof updateSubSegmentSchema>;

const purposeSchema = z.object({ key: keySchema, label: localisedTextSchema, requiresNote: z.boolean().optional(), sortOrder: sortOrderSchema.optional() }).strict();

export const createPurposeSchema = purposeSchema;
export type CreatePurposeDto = z.output<typeof createPurposeSchema>;

export const updatePurposeSchema = z
  .object({ label: localisedTextSchema.optional(), requiresNote: z.boolean().optional(), sortOrder: sortOrderSchema.optional(), status: statusSchema.optional() })
  .strict();
export type UpdatePurposeDto = z.output<typeof updatePurposeSchema>;

export const createCategorySchema = z
  .object({
    key: keySchema,
    label: localisedTextSchema,
    icon: iconSchema,
    minAmountPaise: paiseSchema,
    maxAmountPaise: paiseSchema,
    stepPaise: paiseSchema,
    defaultAmountPaise: paiseSchema,
    tenureOptionsMonths: tenuresSchema,
    illustrativeRateBps: z.number().int().min(0).max(10_000).nullable().optional(),
    sortOrder: sortOrderSchema.optional(),
    segmentKeys: z.array(keySchema).min(1),
    purposes: z.array(purposeSchema).max(50).optional(),
  })
  .strict();
export type CreateCategoryDto = z.output<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.omit({ key: true, purposes: true }).partial().extend({ status: statusSchema.optional() }).strict();
export type UpdateCategoryDto = z.output<typeof updateCategorySchema>;

export const listCitiesSchema = pageQuerySchema.extend({ state: gstStateCodeSchema.optional(), q: z.string().trim().min(1).max(80).optional() });
export type ListCitiesQuery = z.output<typeof listCitiesSchema>;

export const createCitySchema = z.object({ stateGstCode: gstStateCodeSchema, name: z.string().trim().min(2).max(80) }).strict();
export type CreateCityDto = z.output<typeof createCitySchema>;

export const updateCitySchema = z.object({ name: z.string().trim().min(2).max(80).optional(), status: statusSchema.optional() }).strict();
export type UpdateCityDto = z.output<typeof updateCitySchema>;

export const listPincodesSchema = z.object({
  after: pincodeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  state: gstStateCodeSchema.optional(),
  cityId: z.uuid().optional(),
  prefix: z.string().regex(/^\d{1,6}$/).optional(),
});
export type ListPincodesQuery = z.output<typeof listPincodesSchema>;

export const upsertPincodeSchema = z
  .object({ pincode: pincodeSchema, stateGstCode: gstStateCodeSchema, cityId: z.uuid().optional(), district: z.string().trim().min(2).max(80).optional(), status: statusSchema.optional() })
  .strict();
export type UpsertPincodeDto = z.output<typeof upsertPincodeSchema>;

export const listAliasesSchema = pageQuerySchema.extend({ kind: z.enum(Object.values(AliasKind)).optional() });
export type ListAliasesQuery = z.output<typeof listAliasesSchema>;

export const createAliasSchema = z.object({ kind: z.enum(Object.values(AliasKind)), alias: z.string().trim().min(2).max(80), targetId: z.uuid() }).strict();
export type CreateAliasDto = z.output<typeof createAliasSchema>;
