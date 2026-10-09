import { TEMPLATE_PLACEHOLDER } from './notification.constants.js';

export type TemplateParams = Record<string, string | number>;

export class MissingTemplateParamsError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing template params: ${missing.join(', ')}`);
    this.name = 'MissingTemplateParamsError';
  }
}

export function renderTemplate(template: string, params: TemplateParams): string {
  const missing = new Set<string>();
  const rendered = template.replace(TEMPLATE_PLACEHOLDER, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      missing.add(name);
      return '';
    }
    return String(value);
  });
  if (missing.size > 0) throw new MissingTemplateParamsError([...missing]);
  return rendered;
}
