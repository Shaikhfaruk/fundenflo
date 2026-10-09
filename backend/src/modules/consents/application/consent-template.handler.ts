import { ConfigResource, ConsentBasis } from '../../../common/enums/db.enums.js';
import { ConfigHandler } from '../../config-publishing/application/config-handler.decorator.js';
import type { CompileResult, ConfigIssue, ConfigResourceHandler } from '../../config-publishing/domain/config.types.js';
import { type CompiledConsentTemplate, type ConsentTemplateContent, consentTemplateContentSchema } from '../domain/consent-template.schema.js';
import { compileConsentTemplate } from './compile-consent-template.js';
import { ConsentPurposeService } from './consent-purpose.service.js';

@ConfigHandler(ConfigResource.consent_template)
export class ConsentTemplateHandler implements ConfigResourceHandler<ConsentTemplateContent, CompiledConsentTemplate> {
  readonly resource = ConfigResource.consent_template;
  readonly contentSchema = consentTemplateContentSchema;

  constructor(private readonly purposes: ConsentPurposeService) {}

  async compile(content: ConsentTemplateContent): Promise<CompileResult<CompiledConsentTemplate>> {
    const parsed = consentTemplateContentSchema.safeParse(content);
    if (!parsed.success) {
      return { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    }
    const purposes = await this.purposes.active();
    const issues: ConfigIssue[] = [];
    const seen = new Set<string>();
    for (const [index, item] of parsed.data.items.entries()) {
      const path = `content.items.${index}.purpose`;
      const purpose = purposes.get(item.purpose);
      if (seen.has(item.purpose)) issues.push({ path, code: 'duplicate', message: `${item.purpose} is listed twice` });
      seen.add(item.purpose);
      if (!purpose) issues.push({ path, code: 'unknown_purpose', message: `unknown or inactive purpose ${item.purpose}` });
      else if (!purpose.allowedBases.includes(ConsentBasis.consent)) issues.push({ path, code: 'basis_not_allowed', message: `${item.purpose} is not collected by consent` });
    }
    if (issues.length > 0) return { compiled: null, issues };
    return { compiled: compileConsentTemplate(parsed.data), issues: [] };
  }
}
