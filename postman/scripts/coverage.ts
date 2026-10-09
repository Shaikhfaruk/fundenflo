import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { listRequestFiles, POSTMAN_ROOT, rawUrl } from './build.ts';

const BACKEND_DIST = join(POSTMAN_ROOT, '..', 'backend', 'dist');
const URL_PREFIXES: Array<[string, string]> = [
  ['{{baseUrl}}', '/v1'],
  ['{{rootUrl}}', ''],
];

type Route = { method: string; path: string };

if (!existsSync(join(BACKEND_DIST, 'app.module.js'))) {
  process.stderr.write('Build the backend first: pnpm --dir backend build\n');
  process.exit(1);
}

const { listRoutes } = (await import(pathToFileURL(join(BACKEND_DIST, 'scripts', 'route-catalog.js')).href)) as {
  listRoutes: (root: unknown) => Promise<Route[]>;
};
const { AppModule } = (await import(pathToFileURL(join(BACKEND_DIST, 'app.module.js')).href)) as { AppModule: unknown };

const normalise = (url: string) => {
  const withoutQuery = url.split('?')[0] ?? '';
  const prefix = URL_PREFIXES.find(([variable]) => withoutQuery.startsWith(variable));
  return prefix ? `${prefix[1]}${withoutQuery.slice(prefix[0].length)}` : withoutQuery;
};
const key = (method: string, path: string) => `${method} ${path}`;

const isExternal = (raw: string) => !URL_PREFIXES.some(([prefix]) => raw.startsWith(prefix));
const requestFiles = listRequestFiles();
const external = requestFiles.filter((file) => isExternal(rawUrl(file.item)));
const documented = new Map(requestFiles.filter((file) => !isExternal(rawUrl(file.item))).map((file) => [key(file.item.request.method, normalise(rawUrl(file.item))), file.relativePath]));
const routes = await listRoutes(AppModule);
const implemented = new Set(routes.map((route) => key(route.method, route.path)));

const undocumented = routes.filter((route) => !documented.has(key(route.method, route.path)));
const orphaned = [...documented.entries()].filter(([routeKey]) => !implemented.has(routeKey));

for (const route of undocumented) process.stderr.write(`  - no Postman request for ${key(route.method, route.path)}\n`);
for (const [routeKey, file] of orphaned) process.stderr.write(`  - ${file} targets ${routeKey}, which is not implemented\n`);

if (undocumented.length > 0 || orphaned.length > 0) {
  process.stderr.write('Postman coverage check failed\n');
  process.exit(1);
}
process.stdout.write(`Postman coverage check passed: ${routes.length} routes, ${documented.size} requests (+${external.length} to external URLs)\n`);
