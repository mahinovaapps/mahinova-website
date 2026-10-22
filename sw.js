// Service worker: lets the site open like an app and keeps visited pages readable offline.
// It only handles GET requests to this site, so WhatsApp, the tools site and anything
// else always go straight to the network. Change VERSION when assets change.
const VERSION = '20261022b';
const CACHE = 'mahinova-' + VERSION;
const HOMES = ['/', '/bn/', '/hi/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(HOMES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (req, res) => {
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Pages: network first so changes show at once; the saved copy (or the home page) when offline.
    const home = HOMES.find((h) => h !== '/' && u.pathname.startsWith(h)) || '/';
    e.respondWith(fetch(req).then((res) => keep(req, res))
      .catch(() => caches.match(req).then((m) => m || caches.match(home))));
  } else {
    // Styles, scripts, fonts and images: the saved copy at once, refreshed in the background.
    e.respondWith(caches.match(req).then((m) => {
      const fresh = fetch(req).then((res) => keep(req, res));
      return m || fresh;
    }));
  }
});
