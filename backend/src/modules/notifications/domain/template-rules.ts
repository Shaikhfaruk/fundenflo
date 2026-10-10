import type { NotificationChannel } from '../../../common/enums/db.enums.js';
import type { ConfigIssue } from '../../config-publishing/domain/config.types.js';
import { type NotificationTemplateKey, SUBJECT_CHANNELS, TEMPLATE_PARAMS, TEMPLATE_REQUIRED_PARAMS } from './notification.constants.js';
import { templatePlaceholders } from './template-renderer.js';

export type TemplateText = { key: NotificationTemplateKey; channel: NotificationChannel; subject: string | null; body: string };

export function templateIssues(template: TemplateText): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const allowed = new Set(TEMPLATE_PARAMS[template.key]);
  const used = new Set([...templatePlaceholders(template.body), ...templatePlaceholders(template.subject ?? '')]);
  for (const name of used) {
    if (!allowed.has(name)) issues.push({ path: 'body', code: 'unknown_placeholder', message: `{{${name}}} is not available; use ${[...allowed].map((param) => `{{${param}}}`).join(', ')}` });
  }
  for (const name of TEMPLATE_REQUIRED_PARAMS[template.key] ?? []) {
    if (!used.has(name)) issues.push({ path: 'body', code: 'placeholder_required', message: `the message must include {{${name}}}` });
  }
  const needsSubject = SUBJECT_CHANNELS.includes(template.channel);
  if (needsSubject && !template.subject) issues.push({ path: 'subject', code: 'required', message: `${template.channel} messages need a subject` });
  if (!needsSubject && template.subject) issues.push({ path: 'subject', code: 'not_allowed', message: `${template.channel} messages have no subject` });
  return issues;
}
