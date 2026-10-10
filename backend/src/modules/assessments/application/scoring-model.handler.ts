import { ConfigResource } from '../../../common/enums/db.enums.js';
import type { AttributeSpec } from '../../../engines/conditions/condition.types.js';
import { validateCondition } from '../../../engines/conditions/validate.js';
import type { CompiledScoringModel } from '../../../engines/scoring/scoring.types.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { PROVENANCE_RANK } from '../../attributes/domain/attribute.constants.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { ConfigHandler } from '../../config-publishing/application/config-handler.decorator.js';
import type { CompileResult, ConfigIssue, ConfigResourceHandler } from '../../config-publishing/domain/config.types.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { type ScoringModelContent, scoringModelContentSchema, toCompiledScoringModel } from '../domain/scoring-model.schema.js';

const NUMERIC: ReadonlySet<AttributeSpec['dataType']> = new Set(['integer', 'decimal', 'money', 'percentage']);

@ConfigHandler(ConfigResource.scoring_model)
export class ScoringModelHandler implements ConfigResourceHandler<ScoringModelContent, CompiledScoringModel> {
  readonly resource = ConfigResource.scoring_model;
  readonly contentSchema = scoringModelContentSchema;

  constructor(
    private readonly dictionary: AttributeDictionary,
    private readonly catalog: CatalogQueryService,
    private readonly consents: ConsentService,
  ) {}

  async compile(content: ScoringModelContent): Promise<CompileResult<CompiledScoringModel>> {
    const parsed = scoringModelContentSchema.safeParse(content);
    if (!parsed.success) return { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    const model = parsed.data;
    const issues: ConfigIssue[] = [];
    const known = await this.catalog.referenceKeys();
    for (const [index, segment] of model.scope.segments.entries()) if (!known.segments.has(segment)) issues.push({ path: `content.scope.segments.${index}`, code: 'unknown_key', message: `unknown or inactive segment ${segment}` });
    for (const [index, subSegment] of model.scope.subSegments.entries()) if (!known.subSegments.has(subSegment)) issues.push({ path: `content.scope.subSegments.${index}`, code: 'unknown_key', message: `unknown or inactive sub-segment ${subSegment}` });
    const resolver = await this.dictionary.specResolver();
    const purposes = await this.consents.activePurposeKeys();
    for (const [index, factor] of model.factors.entries()) {
      const path = `content.factors.${index}`;
      for (const [position, band] of factor.bands.entries()) for (const issue of validateCondition(band.when, resolver)) issues.push({ path: `${path}.bands.${position}.when${issue.path.slice(1)}`, code: 'invalid_condition', message: issue.message });
      if (factor.linear) {
        const spec = resolver(factor.linear.attr);
        if (!spec) issues.push({ path: `${path}.linear.attr`, code: 'unknown_attribute', message: `unknown or inactive attribute ${factor.linear.attr}` });
        else if (!NUMERIC.has(spec.dataType)) issues.push({ path: `${path}.linear.attr`, code: 'not_numeric', message: `${factor.linear.attr} is not a number` });
      }
      if (factor.requiresConsent && !purposes.has(factor.requiresConsent)) issues.push({ path: `${path}.requiresConsent`, code: 'unknown_purpose', message: `unknown or inactive consent purpose ${factor.requiresConsent}` });
    }
    if (issues.length > 0) return { compiled: null, issues };
    return { compiled: toCompiledScoringModel(model, (provenance) => PROVENANCE_RANK[provenance]), issues: [] };
  }
}
