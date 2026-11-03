/* Offline cache for the in-store iPad (spec §9). Network first, so new data shows as soon as the iPad is online;
   the cached copy is used only when the network is down. Registered only on https (not during local preview). */
const CACHE = 'scr-kiosk-v3';
const CORE = ['./','index.html','css/tokens.css','css/kiosk.css','css/v2.css','js/kiosk.js','data/site-data.json',
  'fonts/PublicSans-subset.woff2','fonts/Newsreader-subset.woff2','assets/scr-wordmark-line-frame.svg',
  'assets/scr-wordmark-stacked-frame.svg','favicon.svg','apple-touch-icon.png','manifest.json',
  'assets/logos/fisher-paykel.svg','assets/logos/bosch.svg','assets/logos/miele.svg','assets/logos/lg.svg','assets/logos/lg-white.svg','assets/logos/ge.svg','assets/logos/speed-queen.png','assets/logos/whirlpool.png','assets/logos/kitchenaid.png','assets/logos/frigidaire.svg','assets/logos/maytag.png','assets/logos/kenmore.svg'];
// assets/bg/* (photo wall) is deliberately not in CORE: it is cached at runtime by the fetch handler below.
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
// activate: drop old caches, take control, then warm every photo-wall tile in the background (QA v2 Fix 1a) so the wall is complete offline.
// Keys are the same folder + file URLs the page requests; a failed photo never blocks activation.
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())
  .then(() => caches.open(CACHE).then(c => fetch('data/site-data.json', {cache: 'no-cache'}).then(r => r.json())
    .then(d => Promise.allSettled(((d.background && d.background.images) || []).map(i => { const u = (d.background.folder || 'assets/bg/') + (i.file || i);
      return c.match(u).then(hit => hit || c.add(u)); })))))
  .catch(() => {})); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('assets/bg/')) {   // photo wall: stale-while-revalidate, cached at runtime (spec-v2 §7.3)
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    })));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: true})));
});
