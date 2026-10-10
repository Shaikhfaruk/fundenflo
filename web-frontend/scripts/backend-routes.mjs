import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROUTES_FILE = resolve(import.meta.dirname, '../../docs/inventory/api-routes.md');

const ROW = /^\|\s*((?:`[A-Z]+`\s*)+)\|\s*`([^`]+)`\s*\|.*\|\s*`([a-z]+)`\s*\|\s*$/;

export const EXCLUDED = [
  { test: (route) => route.split(' ')[1].startsWith('/v0/'), reason: 'compat for the old Expo app' },
  { test: (route) => route.split(' ')[1].startsWith('/health/'), reason: 'infrastructure probes' },
  { test: (route) => route === 'POST /public/leads', reason: 'server-to-server lead intake with an API key' },
];

export function readBackendRoutes() {
  const routes = [];
  for (const line of readFileSync(ROUTES_FILE, 'utf8').split('\n')) {
    const match = ROW.exec(line.trim());
    if (!match || match[3] !== 'useful') continue;
    for (const method of match[1].matchAll(/`([A-Z]+)`/g)) routes.push(`${method[1]} ${match[2]}`);
  }
  return [...new Set(routes)].toSorted((a, b) => a.localeCompare(b));
}

export const exclusionOf = (route) => EXCLUDED.find((rule) => rule.test(route))?.reason ?? null;
