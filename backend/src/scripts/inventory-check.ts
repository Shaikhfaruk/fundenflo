import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AppModule } from '../app.module.js';
import { API_PREFIX, COMPAT_PREFIX } from '../common/constants/http.constants.js';
import { listRoutes } from './route-catalog.js';

const INVENTORY_FILE = resolve(process.cwd(), '../docs/inventory/api-routes.md');
const ROW_PATTERN = /^\|\s*((?:`[A-Z]+`\s*)+)\|\s*`([^`]+)`\s*\|.*\|\s*`([a-z]+)`\s*\|\s*$/;

type InventoryRoute = { key: string; status: string };

const toKey = (method: string, path: string) => `${method} ${path}`;

function readInventory(): InventoryRoute[] {
  return readFileSync(INVENTORY_FILE, 'utf8')
    .split('\n')
    .flatMap((line) => {
      const match = ROW_PATTERN.exec(line.trim());
      if (!match?.[1] || !match[2] || !match[3]) return [];
      const path = match[2].startsWith('/health') || match[2].startsWith(`/${COMPAT_PREFIX}/`) ? match[2] : `/${API_PREFIX}${match[2]}`;
      const status = match[3];
      return [...match[1].matchAll(/`([A-Z]+)`/g)].map((method) => ({ key: toKey(method[1] ?? '', path), status }));
    });
}

const inventory = readInventory();
const routes = await listRoutes(AppModule);
const inventoryByKey = new Map(inventory.map((row) => [row.key, row.status]));
const codeKeys = new Set(routes.map((route) => toKey(route.method, route.path)));

const missing = routes.filter((route) => !inventoryByKey.has(toKey(route.method, route.path)));
const notUseful = routes.filter((route) => {
  const status = inventoryByKey.get(toKey(route.method, route.path));
  return status !== undefined && status !== 'useful';
});
const stale = inventory.filter((row) => row.status === 'useful' && !codeKeys.has(row.key));

const problems = [
  ...missing.map((route) => `not in inventory: ${toKey(route.method, route.path)} (${route.controller}.${route.handler})`),
  ...notUseful.map((route) => `built but not marked useful: ${toKey(route.method, route.path)}`),
  ...stale.map((row) => `marked useful but not in code: ${row.key}`),
];

if (problems.length > 0) {
  process.stderr.write(`Inventory check failed:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Inventory check passed: ${routes.length} routes match docs/inventory/api-routes.md\n`);
