// Offline shell. Every deploy gets its own cache (BUILD is stamped by build.mjs from the file
// contents), filled completely before it takes over, so pages, scripts and styles never mix versions.
const BUILD = '__BUILD__'
const CACHE = 'floop-' + BUILD
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'scripts.js', 'worker.js', 'manifest.webmanifest',
  'vendor/fuse.min.mjs', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png']
const ICONS = '__ICONS__'.split(',').filter(u => u.startsWith('icons/'))   // listed by build.mjs
const OPTIONAL = ['scripts-bundle.json', ...ICONS]   // absent in local dev builds

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE)
    await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))   // all or nothing
    await Promise.allSettled(OPTIONAL.map(u => c.add(new Request(u, { cache: 'reload' }))))
    await self.skipWaiting()
  })())
})
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  e.respondWith((async () => {
    const c = await caches.open(CACHE)
    const hit = await c.match(req, { ignoreSearch: true })
    if (hit) return hit
    try { return await fetch(req) }
    catch { return req.mode === 'navigate' ? (await c.match('index.html')) : Response.error() }
  })())
})
