import { stableStringify } from '../../../common/utils/stable-json.js';
import { sha256 } from '../../../infrastructure/crypto/secure-random.js';
import type { CompiledConsentTemplate, ConsentTemplateContent } from '../domain/consent-template.schema.js';

export const compileConsentTemplate = (content: ConsentTemplateContent): CompiledConsentTemplate => ({
  policyUrl: content.policyUrl ?? null,
  items: content.items.map((item) => {
    const text = { purpose: item.purpose, title: item.title, summary: item.summary ?? null, details: item.details };
    return { ...text, required: item.required, textHash: sha256(stableStringify(text)) };
  }),
});
