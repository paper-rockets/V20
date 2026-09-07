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
const CACHE_VERSION = 'v3';

// A stable, filesystem-safe id for this deployment, derived from the worker's
// scope path: "/PaperRocket-V16-Claude/" -> "paperrocket-v16-claude".
const SCOPE_SLUG =
  (new URL(self.registration.scope).pathname || '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .toLowerCase() || 'root';

const CACHE_PREFIX = `remix3d-${SCOPE_SLUG}-`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Same-origin shell. Relative so it works at any deployment depth.
const STATIC_PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
];

// Third-party extras. Kept separate because cache.addAll() rejects the WHOLE
// batch if any single request fails — one unreachable CDN used to silently take
// the entire app shell down with it, leaving nothing precached at all.
const OPTIONAL_PRECACHE = [
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://cdn.jsdelivr.net/gh/google/draco@1.5.7/javascript/draco_encoder.js',
  'https://cdn.jsdelivr.net/gh/google/draco@1.5.7/javascript/draco_decoder.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // The shell matters, so let a failure here be visible in the log.
      await cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] App shell pre-cache incomplete:', err);
      });
      // Extras are best-effort and independent of one another.
      await Promise.all(
        OPTIONAL_PRECACHE.map((url) =>
          cache.add(url).catch(() => {
            /* offline, blocked, or CDN down - not fatal */
          })
        )
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          // One-time cleanup of the old naming scheme. `remix3d-v14-<timestamp>`
          // was minted fresh on every single page load, so real installs have
          // accumulated dozens of orphaned caches (18 on this dev machine alone)
          // that no current worker will ever claim. Every deployment used that
          // same prefix, so none of them are in use now and all are safe to drop.
          if (/^remix3d-v14-\d+$/.test(key)) {
            console.log('[SW] Removing legacy cache:', key);
            return caches.delete(key);
          }
          // Only ever evict this deployment's own older caches. Anything else on
          // the origin belongs to a different version of the app and is not ours
          // to delete.
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            console.log('[SW] Purging own stale cache:', key);
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
  if (request.url.includes('/@vite/') || request.url.includes('/@react-refresh') || request.url.includes('hot-update')) {
    return;
  }

  // Network-first, deliberately: the tablet must pick up new code on the next
  // load rather than after a cache expiry. The cache is the offline fallback.
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return (await caches.match('./index.html')) || (await caches.match('./'));
        }
        return Response.error();
      })
  );
});
