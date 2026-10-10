import { createTranslator, IntlErrorCode } from 'next-intl';
import { describe, expect, it } from 'vitest';

import messages from './en.json';

type Tree = { [key: string]: string | Tree };

const keysOf = (tree: Tree, prefix = ''): string[] => Object.entries(tree).flatMap(([key, value]) => (typeof value === 'string' ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`)));

describe('English messages', () => {
  it('are all valid ICU messages', () => {
    const invalid: string[] = [];
    const t = createTranslator({ locale: 'en', messages, onError: (error) => (error.code === IntlErrorCode.INVALID_MESSAGE ? invalid.push(error.message) : undefined), getMessageFallback: ({ key }) => key });
    for (const key of keysOf(messages)) (t as (key: string) => string)(key);
    expect(invalid).toEqual([]);
  });
});
