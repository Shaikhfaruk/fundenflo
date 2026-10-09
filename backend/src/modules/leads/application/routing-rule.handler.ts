import { ConfigResource, OrganizationType } from '../../../common/enums/db.enums.js';
import type { AttributeSpec } from '../../../engines/conditions/condition.types.js';
import { validateCondition } from '../../../engines/conditions/validate.js';
import { AccessRepository } from '../../access/infrastructure/access.repository.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { ConfigHandler } from '../../config-publishing/application/config-handler.decorator.js';
import type { CompileResult, ConfigIssue, ConfigResourceHandler } from '../../config-publishing/domain/config.types.js';
import { LEAD_ROUTING_ATTRIBUTES } from '../domain/lead-routing.constants.js';
import { type CompiledRoutingRule, type RoutingRuleContent, routingRuleContentSchema } from '../domain/routing-rule.schema.js';

@ConfigHandler(ConfigResource.routing_rule)
export class RoutingRuleHandler implements ConfigResourceHandler<RoutingRuleContent, CompiledRoutingRule> {
  readonly resource = ConfigResource.routing_rule;
  readonly contentSchema = routingRuleContentSchema;

  constructor(
    private readonly dictionary: AttributeDictionary,
    private readonly access: AccessRepository,
  ) {}

  async resolver(): Promise<(attr: string) => AttributeSpec | undefined> {
    const dictionary = await this.dictionary.specResolver();
    return (attr) => LEAD_ROUTING_ATTRIBUTES[attr] ?? dictionary(attr);
  }

  async compile(content: RoutingRuleContent): Promise<CompileResult<CompiledRoutingRule>> {
    const parsed = routingRuleContentSchema.safeParse(content);
    if (!parsed.success) {
      return { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    }
    const rule = parsed.data;
    const issues: ConfigIssue[] = [];
    if (rule.when !== undefined) {
      for (const issue of validateCondition(rule.when, await this.resolver())) issues.push({ path: `content.when${issue.path.slice(1)}`, code: 'invalid_condition', message: issue.message });
    }
    const organizationIds = rule.pool.organizationIds ?? [];
    if (organizationIds.length > 0) {
      const found = new Map((await this.access.findOrganizations(organizationIds)).map((organization) => [organization.id, organization]));
      for (const [index, id] of organizationIds.entries()) {
        if (found.get(id)?.type !== OrganizationType.partner) issues.push({ path: `content.pool.organizationIds.${index}`, code: 'unknown_organization', message: 'not a partner organization' });
      }
    }
    return issues.length > 0 ? { compiled: null, issues } : { compiled: rule, issues: [] };
  }
}
