import { describe, expect, it } from 'vitest';

import { MissingTemplateParamsError, renderTemplate } from './template-renderer.js';

describe('renderTemplate', () => {
  it('replaces every placeholder', () => {
    expect(renderTemplate('{{code}} expires in {{ minutes }} minutes', { code: '123456', minutes: 5 })).toBe('123456 expires in 5 minutes');
  });

  it('reports every missing param', () => {
    expect(() => renderTemplate('{{a}} {{b}}', {})).toThrow(MissingTemplateParamsError);
    try {
      renderTemplate('{{a}} {{b}} {{a}}', {});
    } catch (error) {
      expect((error as MissingTemplateParamsError).missing).toEqual(['a', 'b']);
    }
  });
});
