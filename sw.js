const CACHE = 'nms-d9d233c385';
const FILES = ["./", "app.css", "app.js", "index.html", "manifest.webmanifest", "places.js", "prado.js", "icons/icon-192.png", "icons/icon-512-maskable.png", "icons/icon-512.png", "img/bernabeu.jpg", "img/bernabeu2.jpg", "img/cibeles.jpg", "img/dosdemayo.jpg", "img/euro2024.jpg", "img/f-baltasar.jpg", "img/f-meninas.jpg", "img/f-pes.jpg", "img/f-vrt-zaprt.jpg", "img/f-vrt.jpg", "img/gines.jpg", "img/hero.jpg", "img/iluzije.jpg", "img/mayor2.jpg", "img/metropolitano.jpg", "img/neptuno.jpg", "img/p-glava-psa.jpg", "img/p-konj.jpg", "img/p-ogledalo.jpg", "img/p-pes-meninas.jpg", "img/p-slon.jpg", "img/p-zirafa.jpg", "img/paja.jpg", "img/prado.jpg", "img/retiro.jpg", "img/sanmiguel.jpg", "img/sol.jpg"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname === 'api.open-meteo.com') return; // weather: always network, app keeps last copy
  if (u.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; }).catch(() => caches.match('./'))));
    return;
  }
  if (u.hostname.endsWith('fonts.googleapis.com') || u.hostname.endsWith('fonts.gstatic.com') || u.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; })));
  }
});
