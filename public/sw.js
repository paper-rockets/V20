// PaperRockets 3D Studio - Service Worker for PWA & Fast Updates
//
// Cache naming and eviction, and why it looks like this
// -----------------------------------------------------
// Caches are per ORIGIN, not per scope. Every GitHub Pages site under one
// account shares one origin:
//
//   paper-rockets.github.io/paper-rocket/
//   paper-rockets.github.io/PaperRocket-V16-Claude/
//
// So two deployments — even in separate repositories — see each other's caches.
// This file previously used `remix3d-v14-${Date.now()}` as the cache name and
// then deleted every cache that did not match it. Three things went wrong:
//
//   1. Date.now() made a new name on every worker start, so no cache was ever
//      reused between visits and the offline store never actually served.
//   2. Deleting every non-matching key wiped OTHER deployments' caches, so
//      opening one demo purged the other and both re-downloaded from scratch.
//   3. Because 1 and 2 combined, each load evicted the last load's work.
//
// The fix: name the cache after this worker's own scope plus a hand-bumped
// version, and only evict caches carrying this same scope prefix. Bump
// CACHE_VERSION when a release must invalidate its own old cache.
const CACHE_VERSION = 'v4';

const SCOPE_SLUG =
  (new URL(self.registration.scope).pathname || '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .toLowerCase() || 'root';

const CACHE_PREFIX = `remix3d-${SCOPE_SLUG}-`;
const SHELL_CACHE_NAME = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `${CACHE_PREFIX}runtime-${CACHE_VERSION}`;
const MAX_RUNTIME_ENTRIES = 80;

// Application Shell - All local, self-hosted assets
const SHELL_PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './fonts/fonts.css',
  './draco/draco_encoder.js',
  './draco/draco_decoder.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
];

// Runtime caching allowlist: only same-origin assets under verified paths
const RUNTIME_ALLOWLIST = /\/(?:assets|models|draco|fonts|icons)\//;

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      await trimCache(cacheName, maxItems);
    }
  } catch (err) {
    console.warn('[SW] Cache trim error:', err);
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE_NAME);
      await shellCache.addAll(SHELL_PRECACHE).catch((err) => {
        console.warn('[SW] App shell pre-cache partial fail:', err);
      });
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (/^remix3d-v14-\d+$/.test(key)) {
            console.log('[SW] Removing legacy cache:', key);
            return caches.delete(key);
          }
          if (
            key.startsWith(CACHE_PREFIX) &&
            key !== SHELL_CACHE_NAME &&
            key !== RUNTIME_CACHE_NAME
          ) {
            console.log('[SW] Purging stale deployment cache:', key);
            return caches.delete(key);
          }
          return undefined;
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests and skip chrome-extension / non-http schemes
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Handle Vite HMR / live reload websocket or internal requests cleanly
  if (
    request.url.includes('/@vite/') ||
    request.url.includes('/@react-refresh') ||
    request.url.includes('hot-update')
  ) {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Network-first strategy with offline cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          // Cache to runtime cache if in allowlist and same origin
          if (isSameOrigin && RUNTIME_ALLOWLIST.test(url.pathname)) {
            caches.open(RUNTIME_CACHE_NAME).then(async (cache) => {
              await cache.put(request, clone);
              await trimCache(RUNTIME_CACHE_NAME, MAX_RUNTIME_ENTRIES);
            });
          }
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback to caches
        const shellMatch = await caches.match(request, { cacheName: SHELL_CACHE_NAME });
        if (shellMatch) return shellMatch;

        const runtimeMatch = await caches.match(request, { cacheName: RUNTIME_CACHE_NAME });
        if (runtimeMatch) return runtimeMatch;

        const anyMatch = await caches.match(request);
        if (anyMatch) return anyMatch;

        if (request.mode === 'navigate') {
          return (
            (await caches.match('./index.html', { cacheName: SHELL_CACHE_NAME })) ||
            (await caches.match('./', { cacheName: SHELL_CACHE_NAME })) ||
            (await caches.match('./index.html')) ||
            (await caches.match('./'))
          );
        }
        return Response.error();
      })
  );
});
