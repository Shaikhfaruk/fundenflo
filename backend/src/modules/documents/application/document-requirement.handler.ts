import { ConfigResource } from '../../../common/enums/db.enums.js';
import { validateCondition } from '../../../engines/conditions/validate.js';
import type { CompiledDocumentRequirement } from '../../../engines/documents/documents.types.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { ConfigHandler } from '../../config-publishing/application/config-handler.decorator.js';
import type { CompileResult, ConfigIssue, ConfigResourceHandler } from '../../config-publishing/domain/config.types.js';
import { type DocumentRequirementContent, documentRequirementContentSchema, toCompiledRequirement } from '../domain/document-requirement.schema.js';
import { DocumentTypeService, documentTextIssues } from './document-type.service.js';

@ConfigHandler(ConfigResource.document_requirement)
export class DocumentRequirementHandler implements ConfigResourceHandler<DocumentRequirementContent, CompiledDocumentRequirement> {
  readonly resource = ConfigResource.document_requirement;
  readonly contentSchema = documentRequirementContentSchema;

  constructor(
    private readonly dictionary: AttributeDictionary,
    private readonly catalog: CatalogQueryService,
    private readonly types: DocumentTypeService,
  ) {}

  async compile(content: DocumentRequirementContent): Promise<CompileResult<CompiledDocumentRequirement>> {
    const parsed = documentRequirementContentSchema.safeParse(content);
    if (!parsed.success) return { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    const requirement = parsed.data;
    const issues: ConfigIssue[] = [];
    const known = await this.catalog.referenceKeys();
    for (const [field, set] of [['segments', known.segments], ['subSegments', known.subSegments], ['categories', known.categories]] as const) {
      for (const [index, value] of (requirement.scope[field] ?? []).entries()) if (!set.has(value)) issues.push({ path: `content.scope.${field}.${index}`, code: 'unknown_key', message: `unknown or inactive ${field} key ${value}` });
    }
    const types = await this.types.activeByKeys(requirement.items.flatMap((item) => item.documentTypes));
    const resolver = await this.dictionary.specResolver();
    for (const [index, item] of requirement.items.entries()) {
      for (const [position, type] of item.documentTypes.entries()) if (!types.has(type)) issues.push({ path: `content.items.${index}.documentTypes.${position}`, code: 'unknown_document_type', message: `unknown or inactive document type ${type}` });
      issues.push(...documentTextIssues(item.description, `content.items.${index}.description`), ...documentTextIssues(item.label, `content.items.${index}.label`));
      if (item.when !== undefined) for (const issue of validateCondition(item.when, resolver)) issues.push({ path: `content.items.${index}.when${issue.path.slice(1)}`, code: 'invalid_condition', message: issue.message });
    }
    if (issues.length > 0) return { compiled: null, issues };
    return { compiled: toCompiledRequirement(requirement), issues: [] };
  }
}
