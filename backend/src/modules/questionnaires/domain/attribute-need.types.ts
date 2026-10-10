import type { AttributeNeed } from '../../../engines/questionnaire/progressive.js';
import type { QuestionnaireContext } from '../../../engines/questionnaire/questionnaire.types.js';

export const ATTRIBUTE_NEED_SOURCE_METADATA = 'questionnaires:attribute-need-source';

export type AttributeNeedContext = QuestionnaireContext & { partyId: string };

export interface AttributeNeedSource {
  needs(context: AttributeNeedContext): Promise<AttributeNeed[]>;
}
