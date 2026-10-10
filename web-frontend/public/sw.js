const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const STATIC_CACHE = `ff-static-${VERSION}`;
const SHELL_CACHE = `ff-shell-${VERSION}`;
const OFFLINE_URL = '/offline';
const SHELL_ASSETS = [OFFLINE_URL, '/icons/icon-192.png', '/icons/favicon.svg'];
const IMMUTABLE_PREFIXES = ['/_next/static/', '/icons/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE && key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const cacheFirst = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
};

const navigation = async (request) => {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.headers.get('RSC') || url.searchParams.has('_rsc')) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }
  if (IMMUTABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) event.respondWith(cacheFirst(request));
});
