import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { exclusionOf, readBackendRoutes } from './backend-routes.mjs';

const routes = readBackendRoutes().filter((route) => !exclusionOf(route));
const target = resolve(import.meta.dirname, '../src/lib/api/backend-routes.ts');
const body = routes.map((route) => `  '${route}',`).join('\n');
writeFileSync(target, `export const BACKEND_ROUTES = [\n${body}\n] as const;\n\nexport type BackendRoute = (typeof BACKEND_ROUTES)[number];\n`);
process.stdout.write(`Wrote ${routes.length} backend routes to src/lib/api/backend-routes.ts\n`);
