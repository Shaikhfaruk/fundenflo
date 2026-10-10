import { ConfigResource } from '../../../common/enums/db.enums.js';
import type { AttributeSpec } from '../../../engines/conditions/condition.types.js';
import { validateCondition } from '../../../engines/conditions/validate.js';
import { placeholdersOf } from '../../../engines/improvement/build-plan.js';
import { type CompiledImprovementRule, SCORE_ATTRIBUTE_PATTERN } from '../../../engines/improvement/improvement.types.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { ConfigHandler } from '../../config-publishing/application/config-handler.decorator.js';
import type { CompileResult, ConfigIssue, ConfigResourceHandler } from '../../config-publishing/domain/config.types.js';
import { DocumentTypeService } from '../../documents/application/document-type.service.js';
import { type ImprovementRuleContent, improvementRuleContentSchema, toCompiledImprovementRule } from '../domain/improvement-rule.schema.js';

const SCORE_SPEC: AttributeSpec = { dataType: 'decimal' };

const ATTENTION_SPEC: AttributeSpec = { dataType: 'boolean' };

const TEXT_FIELDS = ['title', 'found', 'why', 'action', 'evidence'] as const;

@ConfigHandler(ConfigResource.improvement_rule)
export class ImprovementRuleHandler implements ConfigResourceHandler<ImprovementRuleContent, CompiledImprovementRule> {
  readonly resource = ConfigResource.improvement_rule;
  readonly contentSchema = improvementRuleContentSchema;

  constructor(
    private readonly dictionary: AttributeDictionary,
    private readonly catalog: CatalogQueryService,
    private readonly types: DocumentTypeService,
  ) {}

  async compile(content: ImprovementRuleContent): Promise<CompileResult<CompiledImprovementRule>> {
    const parsed = improvementRuleContentSchema.safeParse(content);
    if (!parsed.success) return { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    const rule = parsed.data;
    const issues: ConfigIssue[] = [];
    const known = await this.catalog.referenceKeys();
    for (const [index, segment] of rule.scope.segments.entries()) if (!known.segments.has(segment)) issues.push({ path: `content.scope.segments.${index}`, code: 'unknown_key', message: `unknown or inactive segment ${segment}` });
    const facts = await this.dictionary.specResolver();
    const resolver = (attr: string) => (SCORE_ATTRIBUTE_PATTERN.test(attr) ? (attr.endsWith('.attention') ? ATTENTION_SPEC : SCORE_SPEC) : facts(attr));
    for (const issue of validateCondition(rule.trigger, resolver)) issues.push({ path: `content.trigger${issue.path.slice(1)}`, code: 'invalid_condition', message: issue.message });
    for (const field of TEXT_FIELDS) {
      for (const [locale, template] of Object.entries(rule[field])) {
        for (const placeholder of placeholdersOf(template)) if (!resolver(placeholder)) issues.push({ path: `content.${field}.${locale}`, code: 'unknown_placeholder', message: `{{${placeholder}}} is not an attribute, score.value or factor.<key>.pct|score|attention` });
      }
    }
    if (rule.evidenceDocumentType && !(await this.types.activeByKeys([rule.evidenceDocumentType])).has(rule.evidenceDocumentType)) {
      issues.push({ path: 'content.evidenceDocumentType', code: 'unknown_document_type', message: `unknown or inactive document type ${rule.evidenceDocumentType}` });
    }
    if (issues.length > 0) return { compiled: null, issues };
    return { compiled: toCompiledImprovementRule(rule), issues: [] };
  }
}
