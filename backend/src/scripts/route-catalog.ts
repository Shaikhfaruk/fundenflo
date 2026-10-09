import 'reflect-metadata';

import { type DynamicModule, RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';

import { API_PREFIX, UNPREFIXED_ROUTES } from '../common/constants/http.constants.js';

export type RouteEntry = {
  method: string;
  path: string;
  controller: string;
  handler: string;
};

type ModuleRef = Type | DynamicModule | Promise<DynamicModule>;

const joinPath = (...parts: string[]) =>
  `/${parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/')}`;

const asArray = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : [typeof value === 'string' ? value : '']);

export async function listRoutes(root: Type): Promise<RouteEntry[]> {
  const controllers = new Set<Type>();
  const visited = new Set<unknown>();

  const visit = async (entry: ModuleRef) => {
    const resolved = await entry;
    const moduleClass = typeof resolved === 'function' ? resolved : resolved.module;
    const key = typeof resolved === 'function' ? resolved : resolved;
    if (visited.has(key)) return;
    visited.add(key);
    const staticControllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) as Type[] | undefined) ?? [];
    const dynamicControllers = typeof resolved === 'function' ? [] : (resolved.controllers ?? []);
    for (const controller of [...staticControllers, ...dynamicControllers]) controllers.add(controller);
    const staticImports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) as ModuleRef[] | undefined) ?? [];
    const dynamicImports = typeof resolved === 'function' ? [] : ((resolved.imports ?? []) as ModuleRef[]);
    for (const child of [...staticImports, ...dynamicImports]) await visit(child);
  };
  await visit(root);

  const unprefixed = new Set(UNPREFIXED_ROUTES.map((route) => joinPath(route)));
  const routes: RouteEntry[] = [];
  for (const controller of controllers) {
    const basePaths = asArray(Reflect.getMetadata(PATH_METADATA, controller));
    const prototype = controller.prototype as Record<string, unknown>;
    for (const handler of Object.getOwnPropertyNames(prototype)) {
      const target = prototype[handler];
      if (handler === 'constructor' || typeof target !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, target) as RequestMethod | undefined;
      if (method === undefined) continue;
      for (const base of basePaths) {
        for (const sub of asArray(Reflect.getMetadata(PATH_METADATA, target))) {
          const path = joinPath(base, sub);
          routes.push({
            method: RequestMethod[method],
            path: unprefixed.has(path) ? path : joinPath(API_PREFIX, path),
            controller: controller.name,
            handler,
          });
        }
      }
    }
  }
  return routes.toSorted((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
