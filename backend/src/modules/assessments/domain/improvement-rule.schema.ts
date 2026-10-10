import { z } from 'zod';

import { localisedLongTextSchema } from '../../../common/i18n/locale.js';
import type { Condition } from '../../../engines/conditions/condition.types.js';
import type { CompiledImprovementRule } from '../../../engines/improvement/improvement.types.js';
import { DOCUMENT_KEY_PATTERN } from '../../documents/domain/document.constants.js';
import { DEFAULT_IMPROVEMENT_PRIORITY } from './assessment.constants.js';

export const improvementRuleContentSchema = z
  .object({
    scope: z.object({ segments: z.array(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)).max(10).default([]) }).strict().default({ segments: [] }),
    trigger: z.unknown(),
    priority: z.number().int().min(1).max(100).default(DEFAULT_IMPROVEMENT_PRIORITY),
    title: localisedLongTextSchema,
    found: localisedLongTextSchema,
    why: localisedLongTextSchema,
    action: localisedLongTextSchema,
    evidence: localisedLongTextSchema,
    evidenceDocumentType: z.string().regex(DOCUMENT_KEY_PATTERN).optional(),
  })
  .strict();

export type ImprovementRuleContent = z.output<typeof improvementRuleContentSchema>;

export const toCompiledImprovementRule = (content: ImprovementRuleContent): CompiledImprovementRule => ({
  scope: content.scope,
  trigger: content.trigger as Condition,
  priority: content.priority,
  texts: { title: content.title, found: content.found, why: content.why, action: content.action, evidence: content.evidence },
  evidenceDocumentType: content.evidenceDocumentType ?? null,
});
