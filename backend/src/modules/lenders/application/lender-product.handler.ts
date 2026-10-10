import { ConfigResource } from '../../../common/enums/db.enums.js';
import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { validateCondition } from '../../../engines/conditions/validate.js';
import type { CompiledLenderProduct } from '../../../engines/lending/lending.types.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { PROVENANCE_RANK } from '../../attributes/domain/attribute.constants.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { GeoService } from '../../catalog/application/geo.service.js';
import { ConfigHandler } from '../../config-publishing/application/config-handler.decorator.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import type { CompileContext, CompileResult, ConfigIssue, ConfigResourceHandler } from '../../config-publishing/domain/config.types.js';
import { DocumentTypeService } from '../../documents/application/document-type.service.js';
import { LENDER_PRODUCT_KEY_SEPARATOR } from '../domain/lender.constants.js';
import { type LenderProductContent, lenderProductContentSchema, toCompiledProduct } from '../domain/lender-product.schema.js';
import { LenderRepository } from '../infrastructure/lender.repository.js';

@ConfigHandler(ConfigResource.lender_product)
export class LenderProductHandler implements ConfigResourceHandler<LenderProductContent, CompiledLenderProduct> {
  readonly resource = ConfigResource.lender_product;
  readonly contentSchema = lenderProductContentSchema;

  constructor(
    private readonly lenders: LenderRepository,
    private readonly catalog: CatalogQueryService,
    private readonly geo: GeoService,
    private readonly dictionary: AttributeDictionary,
    private readonly types: DocumentTypeService,
    private readonly config: ConfigPublishingService,
  ) {}

  async compile(content: LenderProductContent, context: CompileContext): Promise<CompileResult<CompiledLenderProduct>> {
    const parsed = lenderProductContentSchema.safeParse(content);
    if (!parsed.success) return { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    const product = parsed.data;
    const issues: ConfigIssue[] = [];
    const separator = context.documentKey.indexOf(LENDER_PRODUCT_KEY_SEPARATOR);
    const lenderKey = separator > 0 ? context.documentKey.slice(0, separator) : '';
    const productKey = separator > 0 ? context.documentKey.slice(separator + 1) : '';
    const lender = lenderKey ? await this.lenders.findOne({ key: lenderKey }) : null;
    if (!lender) issues.push({ path: 'key', code: 'unknown_lender', message: 'the key must start with an existing lender key, such as lenderx.working_capital' });

    const category = await this.catalog.categoryConfig(product.category, DEFAULT_LOCALE);
    if (!category) issues.push({ path: 'content.category', code: 'unknown_key', message: `unknown or inactive category ${product.category}` });
    const known = await this.catalog.referenceKeys();
    for (const [index, segment] of product.segments.entries()) {
      if (!known.segments.has(segment)) issues.push({ path: `content.segments.${index}`, code: 'unknown_key', message: `unknown or inactive segment ${segment}` });
      else if (category && !category.segments.includes(segment)) issues.push({ path: `content.segments.${index}`, code: 'not_offered', message: `${product.category} is not offered to ${segment} borrowers` });
    }
    for (const [index, subSegment] of product.subSegments.entries()) if (!known.subSegments.has(subSegment)) issues.push({ path: `content.subSegments.${index}`, code: 'unknown_key', message: `unknown or inactive sub-segment ${subSegment}` });

    const states = await this.geo.findActiveStates(product.coverage.states);
    const stateIds = new Map(states.map((state) => [state.gstCode, state.id]));
    for (const [index, code] of product.coverage.states.entries()) if (!stateIds.has(code)) issues.push({ path: `content.coverage.states.${index}`, code: 'unknown_state', message: `no active state with GST code ${code}` });
    const cities = new Set((await this.geo.findActiveCities(product.coverage.cityIds)).map((city) => city.id));
    for (const [index, cityId] of product.coverage.cityIds.entries()) if (!cities.has(cityId)) issues.push({ path: `content.coverage.cityIds.${index}`, code: 'unknown_city', message: 'no active city with this id' });

    const resolver = await this.dictionary.specResolver();
    for (const [group, rules] of [['hard', product.eligibility.hard], ['soft', product.eligibility.soft]] as const) {
      for (const [index, rule] of rules.entries()) for (const issue of validateCondition(rule.when, resolver)) issues.push({ path: `content.eligibility.${group}.${index}.when${issue.path.slice(1)}`, code: 'invalid_condition', message: issue.message });
    }
    const types = await this.types.activeByKeys(product.documents.flatMap((item) => item.documentTypes));
    for (const [index, item] of product.documents.entries()) {
      for (const [position, type] of item.documentTypes.entries()) if (!types.has(type)) issues.push({ path: `content.documents.${index}.documentTypes.${position}`, code: 'unknown_document_type', message: `unknown or inactive document type ${type}` });
      if (item.when !== undefined) for (const issue of validateCondition(item.when, resolver)) issues.push({ path: `content.documents.${index}.when${issue.path.slice(1)}`, code: 'invalid_condition', message: issue.message });
    }
    if (product.questionSet && !(await this.config.active(ConfigResource.question_set)).some((set) => set.key === product.questionSet)) {
      issues.push({ path: 'content.questionSet', code: 'unknown_question_set', message: `no published question set ${product.questionSet}` });
    }
    if (issues.length > 0 || !lender) return { compiled: null, issues };
    return { compiled: toCompiledProduct(product, { lenderId: lender.id, lenderKey, productKey }, (provenance) => PROVENANCE_RANK[provenance], stateIds), issues: [] };
  }
}
