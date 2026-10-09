import { stableStringify } from './stable-json.js';

export const JsonChangeKind = {
  Added: 'added',
  Removed: 'removed',
  Changed: 'changed',
} as const;

export type JsonChangeKind = (typeof JsonChangeKind)[keyof typeof JsonChangeKind];

export type JsonChange = { path: string; kind: JsonChangeKind; before?: unknown; after?: unknown };

export type JsonDiff = { changes: JsonChange[]; truncated: boolean };

export const JSON_DIFF_MAX_CHANGES = 500;

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const childPath = (path: string, key: string | number) => (typeof key === 'number' ? `${path}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`);

export function diffJson(before: unknown, after: unknown, maxChanges = JSON_DIFF_MAX_CHANGES): JsonDiff {
  const changes: JsonChange[] = [];
  let truncated = false;

  const push = (change: JsonChange) => {
    if (changes.length >= maxChanges) truncated = true;
    else changes.push(change);
  };

  const walk = (left: unknown, right: unknown, path: string) => {
    if (truncated) return;
    if (Array.isArray(left) && Array.isArray(right)) {
      for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        if (index >= right.length) push({ path: childPath(path, index), kind: JsonChangeKind.Removed, before: left[index] });
        else if (index >= left.length) push({ path: childPath(path, index), kind: JsonChangeKind.Added, after: right[index] });
        else walk(left[index], right[index], childPath(path, index));
      }
      return;
    }
    if (isObject(left) && isObject(right)) {
      for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].toSorted()) {
        if (!(key in right)) push({ path: childPath(path, key), kind: JsonChangeKind.Removed, before: left[key] });
        else if (!(key in left)) push({ path: childPath(path, key), kind: JsonChangeKind.Added, after: right[key] });
        else walk(left[key], right[key], childPath(path, key));
      }
      return;
    }
    if (stableStringify(left) !== stableStringify(right)) push({ path, kind: JsonChangeKind.Changed, before: left, after: right });
  };

  if (before === undefined || before === null) {
    if (after !== undefined && after !== null) push({ path: '$', kind: JsonChangeKind.Added, after });
  } else walk(before, after, '$');
  return { changes, truncated };
}
