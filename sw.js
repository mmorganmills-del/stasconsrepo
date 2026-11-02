/* Offline cache for the in-store iPad (spec §9). Network first, so new data shows as soon as the iPad is online;
   the cached copy is used only when the network is down. Registered only on https (not during local preview). */
const CACHE = 'scr-kiosk-v1';
const CORE = ['./','index.html','css/tokens.css','css/kiosk.css','js/kiosk.js','data/site-data.json',
  'fonts/PublicSans-subset.woff2','fonts/Newsreader-subset.woff2','assets/scr-wordmark-line-frame.svg',
  'assets/scr-wordmark-stacked-frame.svg','favicon.svg','apple-touch-icon.png','manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: true})));
});
