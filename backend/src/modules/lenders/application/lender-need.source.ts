import { referencedAttributes } from '../../../engines/conditions/evaluate.js';
import type { AttributeNeed } from '../../../engines/questionnaire/progressive.js';
import { RuleParty } from '../../../engines/lending/lending.types.js';
import { AttributeNeedSourceFor } from '../../questionnaires/application/attribute-need.registry.js';
import type { AttributeNeedContext, AttributeNeedSource } from '../../questionnaires/domain/attribute-need.types.js';
import { LENDER_NEED_SOURCE_KEY, LENDER_NEED_STAGES } from '../domain/lender.constants.js';
import { LenderCatalogService } from './lender-catalog.service.js';

@AttributeNeedSourceFor(LENDER_NEED_SOURCE_KEY)
export class LenderNeedSource implements AttributeNeedSource {
  constructor(private readonly catalog: LenderCatalogService) {}

  async needs(context: AttributeNeedContext): Promise<AttributeNeed[]> {
    if (!(LENDER_NEED_STAGES as readonly string[]).includes(context.stage)) return [];
    const products = (await this.catalog.liveProducts()).filter(
      ({ compiled }) =>
        (!context.category || compiled.category === context.category) &&
        (!context.segment || compiled.segments.includes(context.segment)) &&
        (!context.subSegment || compiled.subSegments.length === 0 || compiled.subSegments.includes(context.subSegment)),
    );
    return products.flatMap((product) =>
      [...new Set(product.compiled.hard.filter((rule) => rule.party === RuleParty.Primary).flatMap((rule) => referencedAttributes(rule.when)))].map((attributeKey) => ({ attributeKey, weight: 1, required: false, neededBy: product.key })),
    );
  }
}
