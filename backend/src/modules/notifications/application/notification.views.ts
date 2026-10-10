import type { NotificationPreference, NotificationTemplate } from '../../../generated/prisma/client.js';
import { type NotificationTemplateKey, TEMPLATE_PARAMS } from '../domain/notification.constants.js';
import { templatePlaceholders } from '../domain/template-renderer.js';

export const toTemplateView = (template: NotificationTemplate) => ({
  id: template.id,
  key: template.key,
  channel: template.channel,
  locale: template.locale,
  subject: template.subject,
  body: template.body,
  providerTemplateId: template.providerTemplateId,
  active: template.active,
  placeholders: templatePlaceholders(`${template.subject ?? ''} ${template.body}`),
  availableParams: TEMPLATE_PARAMS[template.key as NotificationTemplateKey] ?? [],
  version: template.version,
  updatedAt: template.updatedAt.toISOString(),
});

export const toPreferenceView = (preference: NotificationPreference | null) => ({
  sms: preference?.sms ?? true,
  email: preference?.email ?? true,
  push: preference?.push ?? true,
  version: preference?.version ?? 0,
  updatedAt: preference?.updatedAt.toISOString() ?? null,
});
