import { z } from 'zod';

import { FactProvenance } from '../../../common/enums/db.enums.js';
import { localisedTextSchema } from '../../../common/i18n/locale.js';
import type { Condition } from '../../../engines/conditions/condition.types.js';
import { FactorMethod, MissingPolicy, type CompiledScoringModel } from '../../../engines/scoring/scoring.types.js';
import { PURPOSE_KEY_PATTERN } from '../../consents/domain/consent.constants.js';
import { ASSESSMENT_KEY_PATTERN, DEFAULT_ATTENTION_BELOW_PCT, POINT_BANDS_MAX, SCORING_BANDS_MAX, SCORING_FACTORS_MAX } from './assessment.constants.js';

const scopeKey = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

const factorSchema = z
  .object({
    key: z.string().regex(ASSESSMENT_KEY_PATTERN),
    label: localisedTextSchema,
    max: z.number().int().min(1).max(100),
    method: z.enum(Object.values(FactorMethod)),
    bands: z.array(z.object({ when: z.unknown(), points: z.number().int().min(0).max(100) }).strict()).max(POINT_BANDS_MAX).default([]),
    linear: z.object({ attr: z.string().min(3).max(100), from: z.number(), to: z.number() }).strict().refine((scale) => scale.from !== scale.to, { message: 'from and to must differ' }).optional(),
    missing: z.enum(Object.values(MissingPolicy)).default(MissingPolicy.Insufficient),
    requiresConsent: z.string().regex(PURPOSE_KEY_PATTERN).optional(),
    minProvenance: z.enum(Object.values(FactProvenance)).optional(),
  })
  .strict()
  .refine((factor) => (factor.method === FactorMethod.Bands ? factor.bands.length > 0 && !factor.linear : Boolean(factor.linear) && factor.bands.length === 0), { message: 'bands factors need bands; linear factors need a linear scale and no bands' })
  .refine((factor) => factor.bands.every((band) => band.points <= factor.max), { path: ['bands'], message: 'band points cannot exceed max' });

export const scoringModelContentSchema = z
  .object({
    scope: z.object({ segments: z.array(scopeKey).min(1).max(10), subSegments: z.array(scopeKey).max(20).default([]) }).strict(),
    factors: z.array(factorSchema).min(1).max(SCORING_FACTORS_MAX),
    attentionBelowPct: z.number().int().min(0).max(100).default(DEFAULT_ATTENTION_BELOW_PCT),
    bands: z.array(z.object({ min: z.number().int().min(0).max(100), label: localisedTextSchema }).strict()).min(1).max(SCORING_BANDS_MAX),
  })
  .strict()
  .refine((content) => new Set(content.factors.map((factor) => factor.key)).size === content.factors.length, { path: ['factors'], message: 'factor keys must be unique' })
  .refine((content) => content.bands.some((band) => band.min === 0) && new Set(content.bands.map((band) => band.min)).size === content.bands.length, { path: ['bands'], message: 'bands need unique minimums and one starting at 0' });

export type ScoringModelContent = z.output<typeof scoringModelContentSchema>;

export const toCompiledScoringModel = (content: ScoringModelContent, rankOf: (provenance: FactProvenance) => number): CompiledScoringModel => ({
  scope: content.scope,
  attentionBelowPct: content.attentionBelowPct,
  bands: content.bands,
  factors: content.factors.map((factor) => ({
    key: factor.key,
    label: factor.label,
    max: factor.max,
    method: factor.method,
    bands: factor.bands.map((band) => ({ when: band.when as Condition, points: band.points })),
    linear: factor.linear ?? null,
    missing: factor.missing,
    requiresConsent: factor.requiresConsent ?? null,
    minRank: factor.minProvenance ? rankOf(factor.minProvenance) : null,
  })),
});
