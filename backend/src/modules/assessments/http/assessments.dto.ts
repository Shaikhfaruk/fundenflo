import { z } from 'zod';

import { ANALYSIS_DOCUMENTS_MAX, RecomputeMode } from '../domain/assessment.constants.js';

export const requestAnalysisSchema = z.object({ documentIds: z.array(z.uuid()).min(1).max(ANALYSIS_DOCUMENTS_MAX).optional() }).strict();
export type RequestAnalysisDto = z.output<typeof requestAnalysisSchema>;

export const recomputeSchema = z.object({ mode: z.enum(Object.values(RecomputeMode)).default(RecomputeMode.Reproduce) }).strict();
export type RecomputeDto = z.output<typeof recomputeSchema>;
