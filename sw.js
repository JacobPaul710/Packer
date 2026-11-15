// Offline support. Bump VERSION with every patch so phones pick up the new files.
const VERSION = 'patch-21';
const CACHE = 'packlist-' + VERSION;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/sync.js', 'js/themes.js', 'js/starter.js', 'js/mode.js', 'js/version.js', 'js/firebase-config.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('packlist-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isOwn = url.origin === self.location.origin;
  const isFirebaseCode = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!isOwn && !isFirebaseCode) return; // database traffic goes straight to the network

  // Use the saved copy right away; refresh it in the background when online.
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: isOwn });
    const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    const res = await fresh;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  }));
});
