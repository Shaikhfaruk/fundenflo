import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const POSTMAN_ROOT = join(import.meta.dirname, '..');
export const COLLECTION_DIR = join(POSTMAN_ROOT, 'collection');
export const DIST_DIR = join(POSTMAN_ROOT, 'dist');
export const COLLECTION_FILE = '_collection.json';
export const FOLDER_FILE = '_folder.json';

const ORDER_PREFIX = /^\d+\s+/;
const REQUIRED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export type PostmanRequestItem = {
  name: string;
  request: { method: string; url: { raw: string } | string; [key: string]: unknown };
  event?: unknown[];
  response?: unknown[];
  [key: string]: unknown;
};

export type PostmanFolder = {
  name: string;
  description?: string;
  item: Array<PostmanFolder | PostmanRequestItem>;
  [key: string]: unknown;
};

export type RequestFile = {
  relativePath: string;
  item: PostmanRequestItem;
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

export const displayName = (name: string) => name.replace(ORDER_PREFIX, '').replace(/\.json$/, '');

export const rawUrl = (item: PostmanRequestItem) => (typeof item.request.url === 'string' ? item.request.url : item.request.url.raw);

function validate(file: string, item: PostmanRequestItem) {
  const problems: string[] = [];
  if (!item.name) problems.push('missing name');
  if (!item.request || !REQUIRED_METHODS.has(item.request.method)) problems.push('missing or invalid request.method');
  if (!item.request?.url) problems.push('missing request.url');
  if (!Array.isArray(item.response) || item.response.length === 0) problems.push('missing example responses');
  if (problems.length > 0) throw new Error(`${relative(POSTMAN_ROOT, file)}: ${problems.join(', ')}`);
}

function readFolder(dir: string): PostmanFolder {
  const entries = readdirSync(dir).filter((entry) => !entry.startsWith('.')).sort();
  const meta = entries.includes(FOLDER_FILE) ? readJson<Record<string, unknown>>(join(dir, FOLDER_FILE)) : {};
  const items = entries
    .filter((entry) => entry !== FOLDER_FILE && entry !== COLLECTION_FILE)
    .map((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return readFolder(path);
      const item = readJson<PostmanRequestItem>(path);
      validate(path, item);
      return item;
    });
  return { ...meta, name: displayName(dir.split('/').at(-1) ?? ''), item: items };
}

export function listRequestFiles(dir = COLLECTION_DIR): RequestFile[] {
  return readdirSync(dir)
    .filter((entry) => !entry.startsWith('.') && entry !== FOLDER_FILE && entry !== COLLECTION_FILE)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return listRequestFiles(path);
      return [{ relativePath: relative(COLLECTION_DIR, path), item: readJson<PostmanRequestItem>(path) }];
    });
}

export function buildCollection(): Record<string, unknown> {
  const root = readJson<Record<string, unknown>>(join(COLLECTION_DIR, COLLECTION_FILE));
  return { ...root, item: readFolder(COLLECTION_DIR).item };
}

if (import.meta.main) {
  const collection = buildCollection();
  mkdirSync(DIST_DIR, { recursive: true });
  const output = join(DIST_DIR, 'FundenFlo.postman_collection.json');
  writeFileSync(output, `${JSON.stringify(collection, null, 2)}\n`);
  process.stdout.write(`Built ${listRequestFiles().length} requests into ${relative(process.cwd(), output)}\n`);
}
