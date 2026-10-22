// Service worker: lưu game vào máy để chơi không cần mạng.
// - Vỏ ứng dụng (html/js/css): ưu tiên mạng, rơi về bản đã lưu khi mất mạng.
// - Sprite/âm thanh: ưu tiên bản đã lưu (không đổi), tải lần đầu rồi lưu lại.
const VER = 'pac3d-v1';
const SHELL = VER + '-shell', ASSETS = VER + '-assets';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VER)) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', async e => {
  // Tải trước toàn bộ sprite để chơi offline: { type:'precache', urls:[...] }
  if (!e.data || e.data.type !== 'precache') return;
  const c = await caches.open(ASSETS), urls = e.data.urls; let done = 0;
  const post = m => self.clients.matchAll().then(cs => cs.forEach(x => x.postMessage(m)));
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(urls.slice(i, i + 6).map(async u => { try { if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r); } } catch (err) { } done++; }));
    post({ type: 'precache-progress', done, total: urls.length });
  }
  post({ type: 'precache-done' });
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (url.pathname.includes('/audio-user/')) return;
  const isAsset = /\/assets\/pokemon\//.test(url.pathname) || /\.(png|woff2?|mp3|ogg)$/.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(isAsset ? ASSETS : SHELL);
    if (isAsset) {
      const hit = await cache.match(req); if (hit) return hit;
      const r = await fetch(req); if (r.ok) cache.put(req, r.clone()); return r;
    }
    try { const r = await fetch(req, { cache: 'no-cache' }); if (r.ok) cache.put(req, r.clone()); return r; }
    catch (err) { const hit = await cache.match(req) || await cache.match(new URL('./', location.href).href); if (hit) return hit; throw err; }
  })());
});
