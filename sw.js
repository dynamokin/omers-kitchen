const VERSION = 'omers-kitchen-v33';
const CORE = ['/', '/index.html', '/manifest.json', '/install.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(CORE))
  );
  // Skip waiting immediately — don't wait for old SW
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Fonts → cache-first
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

  // Images → cache-first (change rarely)
  if (url.includes('/images/') || url.match(/\.(jpg|jpeg|png|gif|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // HTML/JS/JSON → network-first, always fresh
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// Check for updates every time the SW starts
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
