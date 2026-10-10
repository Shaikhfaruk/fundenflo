import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { exclusionOf, readBackendRoutes } from './backend-routes.mjs';

const SOURCE_DIR = resolve(import.meta.dirname, '../src');
const SKIP = new Set(['backend-routes.ts']);
const LITERAL = /'((?:GET|POST|PUT|PATCH|DELETE) \/[^']*)'/g;

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return files(path);
  return /\.(ts|tsx)$/.test(name) && !SKIP.has(name) && !/\.(spec|test)\.tsx?$/.test(name) ? [path] : [];
});

const used = new Set();
for (const file of files(SOURCE_DIR)) for (const match of readFileSync(file, 'utf8').matchAll(LITERAL)) used.add(match[1]);

const backend = readBackendRoutes();
const needed = backend.filter((route) => !exclusionOf(route));
const missing = needed.filter((route) => !used.has(route));
const unknown = [...used].filter((route) => !backend.includes(route)).toSorted((a, b) => a.localeCompare(b));
const strict = process.argv.includes('--strict');

process.stdout.write(`Backend routes: ${backend.length}; excluded: ${backend.length - needed.length}; connected: ${needed.length - missing.length} of ${needed.length}\n`);
if (unknown.length > 0) process.stdout.write(`Not in the backend:\n${unknown.map((route) => `  ${route}`).join('\n')}\n`);
if (missing.length > 0 && (strict || process.argv.includes('--list'))) process.stdout.write(`Not connected yet:\n${missing.map((route) => `  ${route}`).join('\n')}\n`);
process.exitCode = unknown.length > 0 || (strict && missing.length > 0) ? 1 : 0;
