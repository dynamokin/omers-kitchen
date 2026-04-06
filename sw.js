// ─── Omer's Dough · Service Worker ───────────────────────
// Strategy: Network-first for app files (always fresh),
// Cache-first for fonts only (rarely change).
// On new version → auto-reload all open tabs.

const VERSION = 'omers-kitchen-v11';
const CORE = ['/', '/index.html', '/manifest.json', '/install.html'];

// ── INSTALL: cache core files ──────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(CORE))
  );
  // Activate immediately, don't wait for old SW to die
  self.skipWaiting();
});

// ── ACTIVATE: delete all old caches ───────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => {
      // Take control of all open tabs immediately
      self.clients.claim();
      // Tell every tab to reload so they get the fresh version
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
});

// ── FETCH: network-first for app, cache-first for fonts ───
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Fonts → cache-first (they never change)
  if (url.includes('fonts.googleapis') || url.includes('fonts.gstatic')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Icons → cache-first (only change with new deploy)
  if (url.includes('/icons/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // App files → network-first, fallback to cache
  e.respondWith(
    fetch(e.request).then(res => {
      // Update cache with fresh response
      const clone = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
