import type { BackendRoute } from './backend-routes';

export type PathParams = Record<string, string | number>;

export type ResolvedEndpoint = { method: string; path: string };

export function endpoint(route: BackendRoute, params: PathParams = {}): ResolvedEndpoint {
  const [method, template] = route.split(' ') as [string, string];
  const path = template.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path parameter ${name} for ${route}`);
    return encodeURIComponent(String(value));
  });
  return { method, path };
}

export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;

export function queryString(query: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) for (const item of value) search.append(key, String(item));
    else search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
