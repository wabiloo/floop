// Offline shell: precache the app, serve it cache-first, refresh in the background.
const CACHE = 'floop-v2'
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'scripts.js', 'worker.js', 'manifest.webmanifest',
  'vendor/fuse.min.mjs', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'scripts-bundle.json']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true })
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r }).catch(() => hit)
    return hit || net
  }))
})
