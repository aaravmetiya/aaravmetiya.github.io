const CACHE = 'streakquest-static-v1';
self.addEventListener('install', ev=>{
  ev.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([
    '/', '/index.html', '/style.css', '/app.js', '/idb.js', '/manifest.json', '/tokens.json'
  ])));
  self.skipWaiting();
});
self.addEventListener('fetch', ev=>{
  ev.respondWith(caches.match(ev.request).then(r=>r || fetch(ev.request)));
});
