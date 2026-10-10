import { z } from 'zod';

import { FactProvenance } from '../../../common/enums/db.enums.js';
import { localisedLongTextSchema, localisedTextSchema } from '../../../common/i18n/locale.js';
import type { Condition } from '../../../engines/conditions/condition.types.js';
import { type CompiledLenderProduct, RuleParty } from '../../../engines/lending/lending.types.js';
import { CONFIG_KEY_PATTERN } from '../../config-publishing/domain/config.constants.js';
import { DocumentStage } from '../../documents/domain/document.constants.js';
import { documentSlotSchema } from '../../documents/domain/document-requirement.schema.js';
import { LENDER_PRODUCT_DOCUMENTS_MAX, LENDER_RULES_MAX, SOFT_RULE_WEIGHT_MAX } from './lender.constants.js';

const key = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const ruleId = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/);
const pincode = z.string().regex(/^[1-9]\d{5}$/);

const range = (minimum: number, maximum: number) =>
  z
    .object({ min: z.number().int().min(minimum).max(maximum), max: z.number().int().min(minimum).max(maximum) })
    .strict()
    .refine((value) => value.min <= value.max, { message: 'min must not exceed max', path: ['min'] });

const ruleSchema = z
  .object({
    id: ruleId,
    when: z.unknown(),
    minProvenance: z.enum(Object.values(FactProvenance)).optional(),
    party: z.enum(Object.values(RuleParty)).default(RuleParty.Primary),
    pass: localisedTextSchema.optional(),
    fail: localisedTextSchema.optional(),
  })
  .strict();

const softRuleSchema = ruleSchema.extend({ weight: z.number().int().min(1).max(SOFT_RULE_WEIGHT_MAX) }).strict();

export const lenderProductContentSchema = z
  .object({
    category: key,
    segments: z.array(key).min(1).max(10),
    subSegments: z.array(key).max(20).default([]),
    amountPaise: range(1, Number.MAX_SAFE_INTEGER),
    tenureMonths: range(1, 480),
    coverage: z
      .object({
        nationwide: z.boolean().default(false),
        states: z.array(z.string().regex(/^\d{2}$/)).max(40).default([]),
        cityIds: z.array(z.uuid()).max(500).default([]),
        includePincodes: z.array(pincode).max(5_000).default([]),
        excludePincodes: z.array(pincode).max(5_000).default([]),
      })
      .strict()
      .refine((coverage) => coverage.nationwide || coverage.states.length + coverage.cityIds.length + coverage.includePincodes.length > 0, { message: 'set the states, cities or pincodes this product serves, or nationwide' }),
    eligibility: z.object({ hard: z.array(ruleSchema).max(LENDER_RULES_MAX).default([]), soft: z.array(softRuleSchema).max(LENDER_RULES_MAX).default([]) }).strict().default({ hard: [], soft: [] }),
    documents: z.array(documentSlotSchema.extend({ stage: z.enum(Object.values(DocumentStage)) }).strict()).max(LENDER_PRODUCT_DOCUMENTS_MAX).default([]),
    questionSet: z.string().regex(CONFIG_KEY_PATTERN).optional(),
    pricingDisclosure: localisedLongTextSchema.optional(),
  })
  .strict()
  .refine((content) => new Set([...content.eligibility.hard, ...content.eligibility.soft].map((rule) => rule.id)).size === content.eligibility.hard.length + content.eligibility.soft.length, { path: ['eligibility'], message: 'rule ids must be unique' })
  .refine((content) => new Set(content.documents.map((item) => item.key)).size === content.documents.length, { path: ['documents'], message: 'document keys must be unique' });

export type LenderProductContent = z.output<typeof lenderProductContentSchema>;

type ProductIdentity = { lenderId: string; lenderKey: string; productKey: string };

const toRule = (rule: LenderProductContent['eligibility']['hard'][number], rankOf: (provenance: FactProvenance) => number) => ({
  id: rule.id,
  when: rule.when as Condition,
  minRank: rule.minProvenance ? rankOf(rule.minProvenance) : null,
  party: rule.party,
  pass: rule.pass ?? null,
  fail: rule.fail ?? null,
});

export const toCompiledProduct = (content: LenderProductContent, identity: ProductIdentity, rankOf: (provenance: FactProvenance) => number, stateIds: ReadonlyMap<string, string>): CompiledLenderProduct => ({
  ...identity,
  category: content.category,
  segments: content.segments,
  subSegments: content.subSegments,
  amountPaise: content.amountPaise,
  tenureMonths: content.tenureMonths,
  coverage: { nationwide: content.coverage.nationwide, stateIds: content.coverage.states.flatMap((code) => stateIds.get(code) ?? []), cityIds: content.coverage.cityIds, includePincodes: content.coverage.includePincodes, excludePincodes: content.coverage.excludePincodes },
  hard: content.eligibility.hard.map((rule) => toRule(rule, rankOf)),
  soft: content.eligibility.soft.map((rule) => ({ ...toRule(rule, rankOf), weight: rule.weight })),
  documents: content.documents.map((item) => ({ key: item.key, documentTypes: item.documentTypes, required: item.required, minCount: item.minCount, when: (item.when as Condition | undefined) ?? null, label: item.label ?? null, description: item.description ?? null, stage: item.stage })),
  questionSet: content.questionSet ?? null,
  pricingDisclosure: content.pricingDisclosure ?? null,
});
