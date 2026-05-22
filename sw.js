// ─── Omer's Kitchen Service Worker ───────────────────────
const VERSION = 'omers-kitchen-v39';
const CORE = ['/', '/index.html', '/manifest.json', '/install.html'];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take control of all tabs immediately
      .then(() => {
        // Notify all open tabs to reload
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'SW_UPDATED', version: VERSION });
          });
        });
      })
  );
});

// ── FETCH ─────────────────────────────────────────────────
function cachePut(request, response) {
  // Clone BEFORE the response body is consumed, then store async.
  const copy = response.clone();
  caches.open(VERSION).then(c => c.put(request, copy)).catch(() => {});
}

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  const isCacheFirst =
    url.includes('fonts.googleapis') ||
    url.includes('fonts.gstatic') ||
    url.includes('/images/') ||
    /\.(jpg|jpeg|png|gif|ico|svg)$/.test(url);

  if (isCacheFirst) {
    // Cache-first for fonts & images
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.ok) cachePut(e.request, res);
          return res;
        });
      })
    );
    return;
  }

  // Network-first for HTML/JS/JSON — always fresh, fall back to cache offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) cachePut(e.request, res);
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── MESSAGE ───────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
