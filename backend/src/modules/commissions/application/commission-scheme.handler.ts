import { ConfigResource } from '../../../common/enums/db.enums.js';
import type { CompiledCommissionScheme } from '../../../engines/commissions/commissions.types.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { ConfigHandler } from '../../config-publishing/application/config-handler.decorator.js';
import type { CompileResult, ConfigIssue, ConfigResourceHandler } from '../../config-publishing/domain/config.types.js';
import { LenderService } from '../../lenders/application/lender.service.js';
import { type CommissionSchemeContent, commissionSchemeContentSchema, toCompiledCommissionScheme } from '../domain/commission-scheme.schema.js';

@ConfigHandler(ConfigResource.commission_scheme)
export class CommissionSchemeHandler implements ConfigResourceHandler<CommissionSchemeContent, CompiledCommissionScheme> {
  readonly resource = ConfigResource.commission_scheme;
  readonly contentSchema = commissionSchemeContentSchema;

  constructor(
    private readonly catalog: CatalogQueryService,
    private readonly lenders: LenderService,
  ) {}

  async compile(content: CommissionSchemeContent): Promise<CompileResult<CompiledCommissionScheme>> {
    const parsed = commissionSchemeContentSchema.safeParse(content);
    if (!parsed.success) return { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    const scheme = parsed.data;
    const issues: ConfigIssue[] = [];
    const known = await this.catalog.referenceKeys();
    for (const [index, category] of scheme.scope.categories.entries()) if (!known.categories.has(category)) issues.push({ path: `content.scope.categories.${index}`, code: 'unknown_key', message: `unknown or inactive loan category ${category}` });
    const lenders = await this.lenders.knownKeys(scheme.scope.lenders);
    for (const [index, lender] of scheme.scope.lenders.entries()) if (!lenders.has(lender)) issues.push({ path: `content.scope.lenders.${index}`, code: 'unknown_key', message: `unknown lender ${lender}` });
    if (issues.length > 0) return { compiled: null, issues };
    return { compiled: toCompiledCommissionScheme(scheme), issues: [] };
  }
}
