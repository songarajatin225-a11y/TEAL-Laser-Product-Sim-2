/* TEAL configurator — offline support.
   Network first, always: a visitor who is online gets the current release and
   the cache is refreshed behind them. The cache answers only when the network
   does not, so the site can be shown with no connection after one visit. */
var CACHE = 'teal-cfg-v8';
var CORE = ['./', 'index.html', 'app.js', 'boot.js', 'anatomy.js', 'anatomy-ws.js', 'cad3d.js', 'anatomy.css', 'data.json', 'access.json', 'manifest.webmanifest',
            'assets/logo.webp', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/cad/manifest.json'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
  }));
});
