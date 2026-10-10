import type { AttributeNeed } from '../../../engines/questionnaire/progressive.js';
import { AttributeNeedSourceFor } from '../../questionnaires/application/attribute-need.registry.js';
import type { AttributeNeedContext, AttributeNeedSource } from '../../questionnaires/domain/attribute-need.types.js';
import { SCORING_NEED_SOURCE_KEY, SCORING_NEED_STAGES } from '../domain/assessment.constants.js';
import { ScoringService } from './scoring.service.js';

@AttributeNeedSourceFor(SCORING_NEED_SOURCE_KEY)
export class ScoringNeedSource implements AttributeNeedSource {
  constructor(private readonly scoring: ScoringService) {}

  async needs(context: AttributeNeedContext): Promise<AttributeNeed[]> {
    if (!(SCORING_NEED_STAGES as readonly string[]).includes(context.stage) || !context.segment) return [];
    const model = await this.scoring.modelFor(context.segment, context.subSegment ?? null);
    return model ? this.scoring.attributesFor(model.compiled).map((attributeKey) => ({ attributeKey, weight: 1, required: false, neededBy: model.key })) : [];
  }
}
