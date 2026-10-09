import { describe, expect, it } from 'vitest';

import { diffJson } from './json-diff.js';

describe('diffJson', () => {
  it('reports added, removed and changed paths in a stable order', () => {
    const before = { stage: 'pre_check', scope: { segments: ['msme'] }, items: [{ key: 'a', required: true }, { key: 'b' }] };
    const after = { stage: 'pre_check', scope: { segments: ['msme', 'individual'] }, items: [{ key: 'a', required: false }], sections: [] };
    expect(diffJson(before, after)).toEqual({
      truncated: false,
      changes: [
        { path: '$.items[0].required', kind: 'changed', before: true, after: false },
        { path: '$.items[1]', kind: 'removed', before: { key: 'b' } },
        { path: '$.scope.segments[1]', kind: 'added', after: 'individual' },
        { path: '$.sections', kind: 'added', after: [] },
      ],
    });
  });

  it('treats a first version as one addition and equal documents as no change', () => {
    expect(diffJson(null, { a: 1 }).changes).toEqual([{ path: '$', kind: 'added', after: { a: 1 } }]);
    expect(diffJson({ a: { b: [1, 2] } }, { a: { b: [1, 2] } }).changes).toEqual([]);
    expect(diffJson({ 'odd key': 1 }, { 'odd key': 2 }).changes[0]?.path).toBe('$["odd key"]');
  });

  it('stops at the change limit and says so', () => {
    const diff = diffJson({ list: [1, 2, 3, 4] }, { list: [5, 6, 7, 8] }, 2);
    expect(diff).toMatchObject({ truncated: true, changes: [{ path: '$.list[0]' }, { path: '$.list[1]' }] });
  });
});
