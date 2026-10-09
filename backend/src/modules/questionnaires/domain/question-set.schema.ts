import { z } from 'zod';

import { localisedTextSchema } from '../../../common/i18n/locale.js';
import { QUESTIONNAIRE_LIMITS } from '../../../engines/questionnaire/questionnaire.constants.js';
import { QUESTION_KEY_PATTERN, QuestionnaireStage, SCOPE_KEY_PATTERN, SECTION_KEY_PATTERN } from './questionnaire.constants.js';

const scopeKeys = z.array(z.string().regex(SCOPE_KEY_PATTERN)).max(50).optional();

export const questionSetContentSchema = z
  .object({
    stage: z.enum(Object.values(QuestionnaireStage)),
    scope: z.object({ segments: scopeKeys, subSegments: scopeKeys, categories: scopeKeys, leadSources: scopeKeys }).strict().default({}),
    sections: z
      .array(z.object({ key: z.string().regex(SECTION_KEY_PATTERN), label: localisedTextSchema }).strict())
      .max(QUESTIONNAIRE_LIMITS.maxSections)
      .default([]),
    items: z
      .array(
        z
          .object({
            questionKey: z.string().regex(QUESTION_KEY_PATTERN),
            required: z.boolean().default(true),
            section: z.string().regex(SECTION_KEY_PATTERN).optional(),
            visibleIf: z.unknown().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(QUESTIONNAIRE_LIMITS.maxItems),
  })
  .strict();

export type QuestionSetContent = z.output<typeof questionSetContentSchema>;
